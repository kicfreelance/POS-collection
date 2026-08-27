import { BrowserWindow, ipcMain } from "electron";
import { Client } from "pg";

export interface PrinterInfo {
  name: string;
  displayName: string;
}

async function getSettingPrinter(column: "receipt_printer_name" | "label_printer_name"): Promise<string | null> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<Record<string, string | null>>(
      `SELECT ${column} AS name FROM business_settings WHERE id = true`,
    );
    return rows[0]?.name ?? null;
  } finally {
    await client.end();
  }
}

/**
 * Resolves the printer for one KOT ticket. A station-specific printer (kitchen,
 * kottu station, bar, ...) takes priority; falls back to the single default KOT
 * printer in Settings for items whose category has no station assigned.
 */
async function getKotPrinterName(stationId: string | null): Promise<string | null> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    if (stationId) {
      const { rows } = await client.query<{ printer_name: string | null }>(
        `SELECT printer_name FROM kitchen_stations WHERE id = $1`,
        [stationId],
      );
      if (rows[0]) return rows[0].printer_name;
    }
    const { rows } = await client.query<{ kot_printer_name: string | null }>(
      `SELECT kot_printer_name FROM business_settings WHERE id = true`,
    );
    return rows[0]?.kot_printer_name ?? null;
  } finally {
    await client.end();
  }
}

function silentPrint(win: BrowserWindow, deviceName: string | null): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    win.webContents.print(
      {
        silent: true,
        printBackground: true,
        deviceName: deviceName ?? undefined,
        // Thermal printers report their own roll width; let the driver + the
        // page's own `@page { size: <width> auto }` CSS govern. Just drop margins.
        margins: { marginType: "none" },
      },
      (success, failureReason) => {
        resolve({ success, error: success ? undefined : failureReason });
      },
    );
  });
}

async function printInternalPage(
  baseUrl: string,
  path: string,
  deviceName: string | null,
): Promise<{ success: boolean; error?: string }> {
  if (!deviceName) {
    return { success: false, error: "No printer selected. Pick one, or set a default in Settings." };
  }

  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: false } });
  try {
    await win.loadURL(`${baseUrl}${path}`);
    // Let the page finish laying out its content before handing it to the print pipeline.
    await new Promise((r) => setTimeout(r, 350));
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

  ipcMain.handle("print:receipt", async (_event, saleId: string, deviceName?: string | null) => {
    const printer = deviceName || (await getSettingPrinter("receipt_printer_name"));
    return printInternalPage(getAppUrl(), `/checkout/receipt/${saleId}?print=1`, printer);
  });

  ipcMain.handle("print:label", async (_event, productId: string, deviceName?: string | null) => {
    const printer = deviceName || (await getSettingPrinter("label_printer_name"));
    return printInternalPage(getAppUrl(), `/products/${productId}/label?print=1`, printer);
  });

  ipcMain.handle("print:kot", async (_event, orderId: string, stationId: string | null) => {
    const kotPrinterName = await getKotPrinterName(stationId);
    const path = stationId ? `/print/kot/${orderId}?station=${stationId}` : `/print/kot/${orderId}`;
    return printInternalPage(getAppUrl(), path, kotPrinterName);
  });
}
