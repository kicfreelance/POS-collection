"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrinterPicker } from "@/components/printer-picker";

export function BarcodeLabel({
  productId,
  name,
  price,
  barcode,
  print = false,
}: {
  productId: string;
  name: string;
  price: string;
  barcode: string;
  print?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    // EAN13 needs exactly 13 digits; anything else falls back to CODE128 so
    // arbitrary SKUs still scan.
    const format = /^\d{13}$/.test(barcode) ? "EAN13" : "CODE128";
    try {
      JsBarcode(svgRef.current, barcode, {
        format,
        width: 2,
        height: 60,
        fontSize: 14,
        margin: 4,
      });
    } catch {
      /* invalid value */
    }
  }, [barcode]);

  return (
    <div className="flex flex-col items-center gap-6 p-10 print:p-0">
      {print && (
        <style>{`@page{size:auto;margin:4mm}
html,body{margin:0!important;background:#fff}
@media print{header,.label-actions{display:none!important}}`}</style>
      )}
      <div className="flex flex-col items-center rounded-lg border border-border/60 bg-white p-4 text-black print:border-none">
        <p className="max-w-48 truncate text-sm font-semibold">{name}</p>
        <p className="text-sm font-medium">{Number(price).toFixed(2)}</p>
        <svg ref={svgRef} />
      </div>

      {!print && (
        <div className="label-actions flex flex-wrap items-center justify-center gap-3 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer />
            Browser print
          </Button>
          <PrinterPicker
            label="Print label"
            storageKey="label"
            onPrint={(deviceName) => window.pos!.printerAPI.printLabel(productId, deviceName)}
          />
        </div>
      )}
    </div>
  );
}
