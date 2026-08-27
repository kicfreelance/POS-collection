"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KotItem {
  productName: string;
  quantity: number;
  unitCode: string;
  notes: string | null;
}

interface KotOrder {
  orderNumber: string;
  orderType: "dine_in" | "take_away";
  tableName: string | null;
  createdAt: string;
  cashierName: string;
}

export function KotView({
  businessName,
  stationName,
  order,
  items,
}: {
  businessName: string;
  stationName: string | null;
  order: KotOrder;
  items: KotItem[];
}) {
  return (
    <div className="flex flex-col items-center gap-6 bg-white p-10 print:p-0">
      <div className="w-80 rounded-lg border border-border/60 bg-white p-5 font-mono text-black print:w-full print:border-none">
        <div className="mb-3 text-center">
          <p className="text-sm font-bold">{businessName}</p>
          <p className="text-lg font-bold">KITCHEN ORDER</p>
          {stationName && <p className="text-base font-bold uppercase">— {stationName} —</p>}
          <p className="mt-1 text-base font-bold">{order.orderNumber}</p>
          <p className="text-sm">
            {order.orderType === "dine_in" ? order.tableName ?? "Dine in" : "TAKE AWAY"}
          </p>
          <p className="text-xs">{new Date(order.createdAt).toLocaleString()}</p>
          <p className="text-xs">Server: {order.cashierName}</p>
        </div>
        <div className="border-t-2 border-dashed border-black py-2">
          {items.map((item, index) => (
            <div key={index} className="mb-2">
              <div className="flex justify-between text-base font-semibold">
                <span>{item.productName}</span>
                <span>
                  x{item.quantity} {item.unitCode}
                </span>
              </div>
              {item.notes && <p className="text-xs text-black/70">Note: {item.notes}</p>}
            </div>
          ))}
        </div>
      </div>
      <Button onClick={() => window.print()} className="print:hidden">
        <Printer />
        Print KOT
      </Button>
    </div>
  );
}
