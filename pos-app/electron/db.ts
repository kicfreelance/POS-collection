import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { app } from "electron";
import type EmbeddedPostgres from "embedded-postgres";

let instance: EmbeddedPostgres | null = null;

// embedded-postgres ships as an ESM-only package; load it at runtime via
// dynamic import() so this file can stay CommonJS like the rest of the
// Electron main process.
async function loadEmbeddedPostgres(): Promise<typeof EmbeddedPostgres> {
  const mod = await import("embedded-postgres");
  return mod.default;
}

function getDataDir(): string {
  // Dev: keep data next to the project so it's easy to inspect or wipe.
  // Packaged: use Electron's per-user data directory.
  if (!app.isPackaged) {
    return path.join(app.getAppPath(), ".pgdata");
  }
  return path.join(app.getPath("userData"), "pgdata");
}

/** Is a process with this PID currently alive? */
function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM = the process exists but we can't signal it (still "alive").
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Best-effort: is the live PID actually a postgres process (vs. a reused number)? */
function looksLikePostgres(pid: number): boolean {
  try {
    if (process.platform === "win32") {
      const out = execFileSync("tasklist", ["/FI", `PID eq ${pid}`, "/NH", "/FO", "CSV"], {
        encoding: "utf8",
        windowsHide: true,
      });
      return /"postgres(?:\.exe)?"/i.test(out);
    }
    const out = execFileSync("ps", ["-p", String(pid), "-o", "comm="], { encoding: "utf8" });
    return /postgres/i.test(out);
  } catch {
    // Can't tell — assume it might be postgres and don't touch the lock file.
    return true;
  }
}

/**
 * After a crash or forced reboot, PostgreSQL can leave a `postmaster.pid` lock
 * file behind whose PID is dead (or reused by an unrelated process). Embedded
 * Postgres then fails to start with an opaque error. Detect that specific case
 * and remove the stale lock so startup can proceed. A lock held by a genuinely
 * running postgres is left untouched.
 */
function clearStalePostmasterPid(dataDir: string): void {
  const pidFile = path.join(dataDir, "postmaster.pid");

  let firstLine: string;
  try {
    firstLine = fs.readFileSync(pidFile, "utf8").split("\n", 1)[0]?.trim() ?? "";
  } catch {
    return; // no lock file — nothing to do
  }

  const remove = (reason: string) => {
    try {
      fs.rmSync(pidFile, { force: true });
      console.log(`[db] removed stale postmaster.pid (${reason})`);
    } catch (err) {
      console.warn(`[db] could not remove stale postmaster.pid: ${String(err)}`);
    }
  };

  const pid = Number.parseInt(firstLine, 10);
  if (!Number.isInteger(pid) || pid <= 0) {
    remove("unparseable PID");
    return;
  }
  if (!pidAlive(pid)) {
    remove(`PID ${pid} is not running`);
    return;
  }
  if (!looksLikePostgres(pid)) {
    remove(`PID ${pid} was reused by a non-postgres process`);
    return;
  }
  // A real postgres holds this data dir — leave the lock alone; instance.start()
  // will surface a clear "already running" style error if that's a problem.
}

export async function startEmbeddedPostgres(): Promise<void> {
  const port = Number(process.env.POS_DB_PORT ?? 54329);
  const user = process.env.POS_DB_USER ?? "pos";
  const password = process.env.POS_DB_PASSWORD ?? "pos_dev_password";
  const database = process.env.POS_DB_NAME ?? "pos";
  const databaseDir = getDataDir();

  const isFirstRun = !fs.existsSync(path.join(databaseDir, "PG_VERSION"));

  // Recover from a stale lock left by a previous unclean shutdown.
  if (!isFirstRun) {
    clearStalePostmasterPid(databaseDir);
  }

  const EmbeddedPostgresCtor = await loadEmbeddedPostgres();
  instance = new EmbeddedPostgresCtor({
    databaseDir,
    port,
    user,
    password,
    authMethod: "password",
    persistent: true,
  });

  if (isFirstRun) {
    await instance.initialise();
  }

  try {
    await instance.start();
  } catch (err) {
    // embedded-postgres sometimes rejects with a non-Error (or nothing), which
    // makes the top-level handler log a useless "undefined". Give it substance.
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
    throw new Error(
      `Embedded PostgreSQL failed to start.\n` +
        `Data dir: ${databaseDir}\n` +
        `Port: ${port}\n` +
        `If this persists, close any other POS instance, or delete the data dir above to reset.\n` +
        `Original error: ${detail}`,
    );
  }

  // Not gated on isFirstRun: if a previous launch initialised the cluster but
  // was interrupted (e.g. port conflict) before the app database was created,
  // isFirstRun would be false on every later run yet the database still
  // wouldn't exist. Idempotently ensure it's there instead.
  try {
    await instance.createDatabase(database);
  } catch (error) {
    const alreadyExists =
      error instanceof Error && /already exists/i.test(error.message);
    if (!alreadyExists) throw error;
  }
}

export async function stopEmbeddedPostgres(): Promise<void> {
  if (instance) {
    await instance.stop();
    instance = null;
  }
}
