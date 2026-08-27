export interface PrinterInfo {
  name: string;
  displayName: string;
}

export interface PrintResult {
  success: boolean;
  error?: string;
}

export interface PosBridge {
  isElectron: true;
  printerAPI: {
    listPrinters: () => Promise<PrinterInfo[]>;
    printReceipt: (saleId: string) => Promise<PrintResult>;
    printKOT: (orderId: string, stationId: string | null) => Promise<PrintResult>;
  };
}

declare global {
  interface Window {
    pos?: PosBridge;
  }
}
