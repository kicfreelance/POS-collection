import path from "node:path";
import os from "node:os";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import {
  activateAndCache,
  clearCache,
  evaluate,
  heartbeatAndCache,
  loadCache,
  machineFingerprint,
  releaseLicense,
  type Evaluation,
  LicenseError,
} from "./license-client";

// Dual-screen: the licence lives on the SERVER machine only. Terminal machines
// never call this — they register their machineId with the Server instead
// (electron/terminal-register.ts).
const PRODUCT = "pos-dualscreen" as const;
const ROLE = "server" as const;
const HEARTBEAT_MS = 12 * 60 * 60 * 1000;

function cacheFile(): string {
  return path.join(app.getPath("userData"), "license", "license.json");
}
function fallbackIdFile(): string {
  return path.join(app.getPath("userData"), "license", "machine-id");
}

let _fp = "";
export function fingerprint(): string {
  return _fp || (_fp = machineFingerprint(fallbackIdFile()));
}

export function currentState(): Evaluation {
  return evaluate(loadCache(cacheFile(), fingerprint()), fingerprint(), { product: PRODUCT });
}

/** The current signed token string, for the Next process's own verification. */
export function currentToken(): string | null {
  return loadCache(cacheFile(), fingerprint())?.token ?? null;
}

function humanError(e: LicenseError): string {
  switch (e.code) {
    case "invalid_key":
      return "That licence key was not recognised.";
    case "revoked":
    case "activation_revoked":
      return "This licence has been revoked. Contact your vendor.";
    case "suspended":
      return "This licence is suspended. Contact your vendor.";
    case "expired":
      return "This licence has expired.";
    case "product_mismatch":
      return "That key is not a Dual-Screen licence.";
    case "transfer_limit_reached":
      return "This licence has been moved too many times. Contact your vendor to release it.";
    case "network_error":
      return "Could not reach the licence server. Check the internet connection and try again.";
    default:
      return e.code || "Activation failed.";
  }
}

let ipcRegistered = false;
function registerIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle("license:get-state", () => {
    const st = currentState();
    return {
      state: st.state,
      reason: st.reason,
      fingerprint: fingerprint(),
      product: PRODUCT,
      entitlement: st.entitlement
        ? {
            edition: st.entitlement.edition,
            expiresAt: st.entitlement.expiresAt,
            seatLimit: st.entitlement.seatLimit,
          }
        : null,
    };
  });

  ipcMain.handle("license:activate", async (_evt, rawKey: unknown) => {
    const key = String(rawKey ?? "").trim();
    if (!key) return { ok: false, error: "empty", detail: "Enter a licence key." };
    try {
      const ev = await activateAndCache(
        cacheFile(),
        key,
        { fingerprint: fingerprint(), role: ROLE, hostname: os.hostname(), appVersion: app.getVersion() },
        async (info) => {
          const res = await dialog.showMessageBox({
            type: "question",
            buttons: ["Move licence to this PC", "Cancel"],
            defaultId: 0,
            cancelId: 1,
            noLink: true,
            message: "This licence is already active on another computer.",
            detail:
              `Transfers remaining: ${info.transfersLeft ?? "?"}.\n\n` +
              "Move it to this computer now? The other computer will stop working " +
              "the next time it checks in.",
          });
          return res.response === 0;
        },
      );
      const ok = ev.state === "ok" || ev.state === "grace";
      return { ok, state: ev.state, reason: ev.reason };
    } catch (e) {
      const le = e instanceof LicenseError ? e : new LicenseError("error", 0, {});
      return { ok: false, error: le.code, detail: humanError(le) };
    }
  });

  ipcMain.handle("license:release", async () => {
    try {
      await releaseLicense(cacheFile(), fingerprint());
      return { ok: true };
    } catch (e) {
      clearCache(cacheFile());
      return { ok: false, error: String(e) };
    }
  });

  ipcMain.on("license:quit", () => app.exit(0));
}

/** Blocks Server startup until it holds a valid (or in-grace) licence. */
export async function ensureLicensed(): Promise<void> {
  registerIpc();

  const initial = currentState();
  if (initial.state === "ok" || initial.state === "grace") return;

  await new Promise<void>((resolve) => {
    const win = new BrowserWindow({
      width: 540,
      height: 660,
      resizable: false,
      fullscreenable: false,
      title: "POS Dual Screen — Licence",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    win.removeMenu();
    void win.loadFile(path.join(app.getAppPath(), "electron", "license.html"));

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      ipcMain.removeListener("license:continue", onContinue);
      win.removeListener("closed", onClosed);
      if (!win.isDestroyed()) win.close();
      resolve();
    };
    const onContinue = () => {
      const st = currentState();
      if (st.state === "ok" || st.state === "grace") finish();
    };
    const onClosed = () => {
      if (settled) return;
      const st = currentState();
      if (st.state === "ok" || st.state === "grace") {
        settled = true;
        ipcMain.removeListener("license:continue", onContinue);
        resolve();
      } else {
        app.exit(0);
      }
    };

    ipcMain.on("license:continue", onContinue);
    win.on("closed", onClosed);
  });
}

/**
 * Periodic online revalidation for the Server. `getActiveTerminals` lets the
 * Server report live seat usage upstream. On a hard rejection it quits, which
 * also takes down every Terminal (they render this Server's app).
 */
export function startHeartbeat(
  getActiveTerminals?: () => Array<{ machineId: string; hostname?: string; lastSeen?: number }>,
): void {
  const tick = async () => {
    const terminals = getActiveTerminals?.() ?? [];
    let ev: Evaluation;
    try {
      ev = await heartbeatAndCache(cacheFile(), {
        fingerprint: fingerprint(),
        role: ROLE,
        hostname: os.hostname(),
        appVersion: app.getVersion(),
        activeTerminals: terminals.length,
        terminals,
      });
    } catch {
      return;
    }
    if (ev.state === "invalid") {
      await dialog.showMessageBox({
        type: "error",
        buttons: ["Quit"],
        noLink: true,
        message: "POS Dual Screen licence is no longer valid",
        detail:
          `Reason: ${ev.reason ?? "unknown"}.\n\n` +
          "The Server and all Terminals will stop until this is re-activated.",
      });
      app.exit(0);
    }
  };

  setTimeout(() => void tick(), 60_000);
  setInterval(() => void tick(), HEARTBEAT_MS);
}
