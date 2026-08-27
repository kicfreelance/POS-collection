import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("pos", {
  isElectron: true,
  printerAPI: {
    listPrinters: () => ipcRenderer.invoke("printers:list"),
    printReceipt: (saleId: string) => ipcRenderer.invoke("print:receipt", saleId),
    printKOT: (orderId: string, stationId: string | null) => ipcRenderer.invoke("print:kot", orderId, stationId),
  },
});

contextBridge.exposeInMainWorld("setup", {
  testConnection: (host: string, port: number) => ipcRenderer.invoke("setup:test-connection", host, port),
  saveConfig: (config: { role: "server" } | { role: "terminal"; serverHost: string; serverPort: number }) =>
    ipcRenderer.invoke("setup:save", config),
});
