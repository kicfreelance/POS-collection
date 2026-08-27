"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrinterPicker } from "@/components/printer-picker";
import { Receipt } from "@/lib/receipt/receipt";
import type { ReceiptData, ReceiptStyle } from "@/lib/receipt/types";

export function ReceiptView({
  saleId,
  data,
  style,
  print,
}: {
  saleId: string;
  data: ReceiptData;
  style: ReceiptStyle;
  print: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-6 p-10 print:p-0">
      <div className="bg-white shadow-md print:shadow-none">
        <Receipt data={data} style={style} print={print} />
      </div>

      {!print && (
        <div className="receipt-actions flex flex-wrap items-center justify-center gap-3 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer />
            Browser print
          </Button>
          <PrinterPicker
            label="Print receipt"
            storageKey="receipt"
            onPrint={(deviceName) =>
              window.pos!.printerAPI.printReceipt(saleId, deviceName)
            }
          />
        </div>
      )}
    </div>
  );
}
