import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("pos", {
  isElectron: true,
  printerAPI: {
    listPrinters: () => ipcRenderer.invoke("printers:list"),
    printReceipt: (saleId: string, deviceName?: string | null) =>
      ipcRenderer.invoke("print:receipt", saleId, deviceName ?? null),
    printLabel: (productId: string, deviceName?: string | null) =>
      ipcRenderer.invoke("print:label", productId, deviceName ?? null),
    printKOT: (orderId: string, stationId: string | null) => ipcRenderer.invoke("print:kot", orderId, stationId),
  },
});

contextBridge.exposeInMainWorld("setup", {
  testConnection: (host: string, port: number) => ipcRenderer.invoke("setup:test-connection", host, port),
  saveConfig: (config: { role: "server" } | { role: "terminal"; serverHost: string; serverPort: number }) =>
    ipcRenderer.invoke("setup:save", config),
});

// Bridge used only by the licence key-entry window (electron/license.html).
contextBridge.exposeInMainWorld("license", {
  getState: () => ipcRenderer.invoke("license:get-state"),
  activate: (key: string) => ipcRenderer.invoke("license:activate", key),
  release: () => ipcRenderer.invoke("license:release"),
  continue: () => ipcRenderer.send("license:continue"),
  quit: () => ipcRenderer.send("license:quit"),
});
