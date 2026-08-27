import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("pos", {
  isElectron: true,
  printerAPI: {
    listPrinters: () => ipcRenderer.invoke("printers:list"),
    printReceipt: (saleId: string) => ipcRenderer.invoke("print:receipt", saleId),
    printKOT: (orderId: string, stationId: string | null) => ipcRenderer.invoke("print:kot", orderId, stationId),
  },
});
