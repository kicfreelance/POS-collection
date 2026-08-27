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

const PRODUCT = "pos-standard" as const;
const ROLE = "standalone" as const;
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
      return "That key is for a different product.";
    case "transfer_limit_reached":
      return "This licence has already been moved the maximum number of times. Contact your vendor to release it.";
    case "already_activated_elsewhere":
      return "This licence is active on another computer.";
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

  ipcMain.on("license:continue", () => {
    /* resolved by ensureLicensed's listener */
  });
  ipcMain.on("license:quit", () => app.exit(0));
}

/**
 * Blocks startup until the app holds a valid (or in-grace) licence. Opens a
 * dedicated key-entry window otherwise; closing it without activating quits.
 */
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
      title: "POS — Licence",
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
 * Periodic online revalidation. Call once after the app window is up. On a hard
 * rejection (revoked / expired / suspended) it shows a blocking notice and quits;
 * transient network failures are ignored until the cached token ages past grace.
 */
export function startHeartbeat(): void {
  const tick = async () => {
    let ev: Evaluation;
    try {
      ev = await heartbeatAndCache(cacheFile(), {
        fingerprint: fingerprint(),
        role: ROLE,
        hostname: os.hostname(),
        appVersion: app.getVersion(),
      });
    } catch {
      return;
    }
    if (ev.state === "invalid") {
      await dialog.showMessageBox({
        type: "error",
        buttons: ["Quit"],
        noLink: true,
        message: "POS licence is no longer valid",
        detail:
          `Reason: ${ev.reason ?? "unknown"}.\n\n` +
          "The app will now close. Contact your vendor or re-activate on next launch.",
      });
      app.exit(0);
    }
  };

  setTimeout(() => void tick(), 60_000);
  setInterval(() => void tick(), HEARTBEAT_MS);
}
