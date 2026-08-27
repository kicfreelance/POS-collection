"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReceiptItem {
  productName: string;
  quantity: number;
  unitCode: string;
  unitPrice: number;
  lineTotal: number;
}

interface ReceiptPayment {
  method: string;
  amount: number;
}

interface ReceiptSale {
  saleNumber: string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  changeGiven: number;
  createdAt: string;
  cashierName: string;
}

interface ReceiptBusiness {
  name: string;
  address: string | null;
  header: string | null;
  footer: string | null;
  currencySymbol: string;
}

export function ReceiptView({
  business,
  sale,
  items,
  payments,
}: {
  business: ReceiptBusiness;
  sale: ReceiptSale;
  items: ReceiptItem[];
  payments: ReceiptPayment[];
}) {
  const c = business.currencySymbol;
  return (
    <div className="flex flex-col items-center gap-6 p-10 print:p-0">
      <div className="w-80 rounded-lg border border-border/60 bg-white p-5 font-mono text-xs text-black print:w-full print:border-none">
        <div className="mb-3 text-center">
          <p className="text-sm font-bold">{business.name}</p>
          {business.address && <p>{business.address}</p>}
          {business.header && <p className="mt-1">{business.header}</p>}
          <p className="mt-2">{sale.saleNumber}</p>
          <p>{new Date(sale.createdAt).toLocaleString()}</p>
          <p>Cashier: {sale.cashierName}</p>
        </div>
        <div className="border-t border-dashed border-black/40 py-2">
          {items.map((item, index) => (
            <div key={index} className="mb-1">
              <div className="flex justify-between">
                <span>{item.productName}</span>
                <span>
                  {c}
                  {item.lineTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-black/60">
                <span>
                  {item.quantity} {item.unitCode} x {c}
                  {item.unitPrice.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-dashed border-black/40 py-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>
              {c}
              {sale.subtotal.toFixed(2)}
            </span>
          </div>
          {sale.discountTotal > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>
                -{c}
                {sale.discountTotal.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Tax</span>
            <span>
              {c}
              {sale.taxTotal.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL</span>
            <span>
              {c}
              {sale.total.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="border-t border-dashed border-black/40 py-2">
          {payments.map((payment, index) => (
            <div key={index} className="flex justify-between capitalize">
              <span>{payment.method}</span>
              <span>
                {c}
                {payment.amount.toFixed(2)}
              </span>
            </div>
          ))}
          {sale.changeGiven > 0 && (
            <div className="flex justify-between">
              <span>Change</span>
              <span>
                {c}
                {sale.changeGiven.toFixed(2)}
              </span>
            </div>
          )}
        </div>
        <p className="mt-3 text-center">{business.footer || "Thank you!"}</p>
      </div>
      <Button onClick={() => window.print()} className="print:hidden">
        <Printer />
        Print receipt
      </Button>
    </div>
  );
}
