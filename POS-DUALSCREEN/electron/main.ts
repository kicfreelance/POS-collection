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
import { loadNodeConfig } from "./node-config";
import { registerSetupHandlers } from "./setup-ipc";

let isQuitting = false;

async function createWindow(url: string): Promise<BrowserWindow> {
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
  return win;
}

async function createSetupWindow(): Promise<void> {
  registerSetupHandlers();
  const win = new BrowserWindow({
    width: 560,
    height: 620,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await win.loadFile(path.join(app.getAppPath(), "electron", "setup.html"));
}

async function startAsServer(): Promise<string> {
  if (app.isPackaged) {
    applyProductionEnv();
  }

  await startEmbeddedPostgres();
  await runMigrations(path.join(app.getAppPath(), "db", "migrations"));
  await seedDatabase();

  return app.isPackaged
    ? await startProductionServer()
    : "http://localhost:3000"; // dev: served by `next dev`, started alongside Electron by npm run dev
}

app.whenReady().then(async () => {
  try {
    const config = loadNodeConfig();

    if (!config) {
      await createSetupWindow();
      return;
    }

    const url =
      config.role === "server"
        ? await startAsServer()
        : `http://${config.serverHost}:${config.serverPort ?? 3000}`;

    await createWindow(url);
    registerPrintingHandlers(() => url);

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
      "POS Dual Screen failed to start",
      `${details}\n\nIf this is a Terminal, check that the Server PC is running and reachable on the network.`,
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
