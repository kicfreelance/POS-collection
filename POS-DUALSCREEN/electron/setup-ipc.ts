import { app, ipcMain } from "electron";
import { saveNodeConfig, type NodeConfig } from "./node-config";

async function testConnection(host: string, port: number): Promise<{ ok: boolean; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`http://${host}:${port}/api/health`, { signal: controller.signal });
    if (!response.ok) {
      return { ok: false, error: `Server responded with HTTP ${response.status}` };
    }
    const body = (await response.json()) as { ok?: boolean };
    return body.ok ? { ok: true } : { ok: false, error: "Server reported an unhealthy database" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

export function registerSetupHandlers(): void {
  ipcMain.handle("setup:test-connection", async (_event, host: string, port: number) => testConnection(host, port));

  ipcMain.handle("setup:save", async (_event, config: NodeConfig) => {
    saveNodeConfig(config);
    app.relaunch();
    app.exit(0);
  });
}
