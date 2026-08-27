import { app, BrowserWindow, dialog } from "electron";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ path: path.join(app.getAppPath(), ".env") });

import { startEmbeddedPostgres, stopEmbeddedPostgres } from "./db";
import { runMigrations } from "../db/migrate";
import { seedDatabase } from "../db/seed";
import { applyProductionEnv, startProductionServer, stopProductionServer } from "./production-env";
import { registerPrintingHandlers } from "./printing";
import { ensureLicensed, startHeartbeat } from "./license-gate";

let isQuitting = false;

async function createWindow(url: string): Promise<void> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadURL(url);
}

app.whenReady().then(async () => {
  try {
    if (app.isPackaged) {
      applyProductionEnv();
    }

    // Gate startup on a valid licence before any DB / server work.
    await ensureLicensed();

    await startEmbeddedPostgres();
    await runMigrations(path.join(app.getAppPath(), "db", "migrations"));

    const credFile = path.join(app.getPath("userData"), "FIRST-RUN-LOGIN.txt");
    process.env.POS_CRED_FILE = credFile;
    const seedResult = await seedDatabase();
    if (seedResult) {
      await dialog.showMessageBox({
        type: "info",
        buttons: ["OK"],
        noLink: true,
        message: "POS first-run login created",
        detail:
          `Username:  admin\nPIN:  ${seedResult.createdAdminPin}\n\n` +
          `This was also saved to:\n${credFile}\n\n` +
          `Please change the PIN after logging in.`,
      });
    }

    const url = app.isPackaged
      ? await startProductionServer()
      : "http://localhost:3000"; // dev: served by `next dev`, started alongside Electron by npm run dev

    await createWindow(url);
    registerPrintingHandlers(() => url);
    startHeartbeat();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(url);
      }
    });
  } catch (error) {
    const details = error instanceof Error ? (error.stack ?? error.message) : String(error);
    try {
      fs.writeFileSync(path.join(app.getPath("userData"), "startup-error.log"), `${new Date().toISOString()}\n${details}\n`);
    } catch {
      // best-effort diagnostics; fall through to the dialog regardless
    }
    dialog.showErrorBox(
      "POS failed to start",
      `${details}\n\nIf another copy of POS is already running, close it first and try again.`,
    );
    app.exit(1);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async (event) => {
  if (isQuitting) return;
  event.preventDefault();
  isQuitting = true;
  stopProductionServer();
  await stopEmbeddedPostgres();
  app.quit();
});
