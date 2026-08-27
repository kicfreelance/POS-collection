"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BarcodeLabel({
  name,
  price,
  barcode,
}: {
  name: string;
  price: string;
  barcode: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    JsBarcode(svgRef.current, barcode, {
      format: "EAN13",
      width: 2,
      height: 60,
      fontSize: 14,
      margin: 4,
    });
  }, [barcode]);

  return (
    <div className="flex flex-col items-center gap-6 p-10 print:p-0">
      <div className="flex flex-col items-center rounded-lg border border-border/60 bg-white p-4 text-black print:border-none">
        <p className="max-w-48 truncate text-sm font-semibold">{name}</p>
        <p className="text-sm font-medium">{Number(price).toFixed(2)}</p>
        <svg ref={svgRef} />
      </div>
      <Button onClick={() => window.print()} className="print:hidden">
        <Printer />
        Print label
      </Button>
    </div>
  );
}
