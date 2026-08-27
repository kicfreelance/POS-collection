import { BrowserWindow, ipcMain } from "electron";

export interface PrinterInfo {
  name: string;
  displayName: string;
}

/**
 * Printer assignments live in the app's own Postgres, which only the Server
 * node runs. Both Server and Terminal nodes resolve them over HTTP against
 * whichever base URL they're already pointed at (127.0.0.1 for a Server
 * printing its own tickets, or the remote Server's LAN address for a
 * Terminal) — this keeps Postgres itself off the network entirely.
 */
async function getPrinterName(baseUrl: string, params: string): Promise<string | null> {
  try {
    const response = await fetch(`${baseUrl}/api/print-config?${params}`);
    if (!response.ok) return null;
    const body = (await response.json()) as { printerName: string | null };
    return body.printerName;
  } catch {
    return null;
  }
}

function silentPrint(win: BrowserWindow, deviceName: string | null): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    win.webContents.print(
      { silent: true, printBackground: true, deviceName: deviceName ?? undefined },
      (success, failureReason) => {
        resolve({ success, error: success ? undefined : failureReason });
      },
    );
  });
}

async function printInternalPage(baseUrl: string, path: string, deviceName: string | null): Promise<{ success: boolean; error?: string }> {
  if (!deviceName) {
    return { success: false, error: "No printer assigned in Settings" };
  }

  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: false } });
  try {
    await win.loadURL(`${baseUrl}${path}`);
    // Let the page finish laying out its content before handing it to the print pipeline.
    await new Promise((r) => setTimeout(r, 300));
    return await silentPrint(win, deviceName);
  } finally {
    win.destroy();
  }
}

export function registerPrintingHandlers(getAppUrl: () => string): void {
  ipcMain.handle("printers:list", async (): Promise<PrinterInfo[]> => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return [];
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((p) => ({ name: p.name, displayName: p.displayName }));
  });

  ipcMain.handle("print:receipt", async (_event, saleId: string) => {
    const baseUrl = getAppUrl();
    const receiptPrinterName = await getPrinterName(baseUrl, "type=receipt");
    return printInternalPage(baseUrl, `/checkout/receipt/${saleId}`, receiptPrinterName);
  });

  ipcMain.handle("print:kot", async (_event, orderId: string, stationId: string | null) => {
    const baseUrl = getAppUrl();
    const kotPrinterName = await getPrinterName(baseUrl, stationId ? `type=kot&station=${stationId}` : "type=kot");
    const path = stationId ? `/print/kot/${orderId}?station=${stationId}` : `/print/kot/${orderId}`;
    return printInternalPage(baseUrl, path, kotPrinterName);
  });
}
