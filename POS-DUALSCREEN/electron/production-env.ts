import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { app } from "electron";

// Matches the defaults electron/db.ts falls back to when these env vars are
// unset, so a packaged app and a dev run (via .env) agree without duplicating
// values in two places.
const DB_PORT = 54329;
const DB_USER = "pos";
const DB_PASSWORD = "pos_dev_password";
const DB_NAME = "pos";
const APP_PORT = 3000;

function getOrCreateAuthSecret(): string {
  const secretPath = path.join(app.getPath("userData"), "auth-secret.txt");
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, "utf-8").trim();
  }
  const secret = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  fs.writeFileSync(secretPath, secret, "utf-8");
  return secret;
}

/**
 * Applies production env vars to the CURRENT process (the Electron main
 * process itself, which runs migrate/seed via its own `pg` client — not just
 * the spawned Next.js server). Call this once, before anything touches the
 * database, so both the main process and anything it later spawns (which
 * inherits process.env) see the same values.
 */
export function applyProductionEnv(): void {
  Object.assign(process.env, {
    POS_DB_PORT: String(DB_PORT),
    POS_DB_USER: DB_USER,
    POS_DB_PASSWORD: DB_PASSWORD,
    POS_DB_NAME: DB_NAME,
    DATABASE_URL: `postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${DB_PORT}/${DB_NAME}`,
    AUTH_SECRET: getOrCreateAuthSecret(),
    NODE_ENV: "production",
    PORT: String(APP_PORT),
    // Bound to all interfaces (not just localhost) so Terminal PCs on the LAN
    // can reach this Server's Next.js app. Postgres itself never leaves this
    // machine — only the main process's own DATABASE_URL above touches it.
    HOSTNAME: "0.0.0.0",
  });
}

function waitForPort(port: number, host: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, host);
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
        } else {
          setTimeout(attempt, 300);
        }
      });
    };
    attempt();
  });
}

let serverProcess: ChildProcess | null = null;

/**
 * Spawns the Next.js standalone server bundled at resources/standalone using
 * Electron's own executable as the Node runtime (ELECTRON_RUN_AS_NODE), so a
 * packaged build never depends on a system Node install — important for
 * Windows 7/8 targets where one may not be present.
 */
export async function startProductionServer(): Promise<string> {
  const standaloneDir = path.join(process.resourcesPath, "standalone");
  const serverPath = path.join(standaloneDir, "server.js");

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: standaloneDir,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout?.on("data", (chunk) => console.log(`[server] ${chunk}`.trim()));
  serverProcess.stderr?.on("data", (chunk) => console.error(`[server] ${chunk}`.trim()));

  await waitForPort(APP_PORT, "127.0.0.1", 30_000);
  return `http://127.0.0.1:${APP_PORT}`;
}

export function stopProductionServer(): void {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
}
