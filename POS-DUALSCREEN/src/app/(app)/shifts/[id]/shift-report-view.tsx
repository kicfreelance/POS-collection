"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ShiftInfo {
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  variance: number | null;
  status: string;
}

interface ItemRow {
  productName: string;
  quantity: number;
  revenue: number;
  discount: number;
}

interface Summary {
  gross: number;
  discountTotal: number;
  taxTotal: number;
  net: number;
  saleCount: number;
}

interface PaymentRow {
  method: string;
  amount: number;
}

export function ShiftReportView({
  shift,
  items,
  summary,
  payments,
}: {
  shift: ShiftInfo;
  items: ItemRow[];
  summary: Summary;
  payments: PaymentRow[];
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-10 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shift Summary</h1>
          <p className="text-sm text-muted-foreground">
            {shift.cashierName} &middot; {new Date(shift.openedAt).toLocaleString()}
            {shift.closedAt ? ` – ${new Date(shift.closedAt).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Badge variant={shift.status === "open" ? "secondary" : "outline"}>{shift.status}</Badge>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Gross sales</p>
            <p className="text-lg font-semibold">{summary.gross.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Discounts</p>
            <p className="text-lg font-semibold">{summary.discountTotal.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Tax</p>
            <p className="text-lg font-semibold">{summary.taxTotal.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Net sales ({summary.saleCount})</p>
            <p className="text-lg font-semibold">{summary.net.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Cash drawer</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Opening</p>
            <p className="font-semibold">{shift.openingCash.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Expected</p>
            <p className="font-semibold">{shift.expectedCash != null ? shift.expectedCash.toFixed(2) : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Counted</p>
            <p className="font-semibold">{shift.closingCash != null ? shift.closingCash.toFixed(2) : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Variance</p>
            <p
              className={`font-semibold ${
                shift.variance == null || shift.variance === 0
                  ? ""
                  : shift.variance > 0
                    ? "text-emerald-500"
                    : "text-destructive"
              }`}
            >
              {shift.variance != null ? `${shift.variance > 0 ? "+" : ""}${shift.variance.toFixed(2)}` : "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Payment methods</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.method}>
                  <TableCell className="capitalize">{payment.method}</TableCell>
                  <TableCell>{payment.amount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No payments recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items sold</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Discount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.productName}>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell>{item.quantity.toFixed(2)}</TableCell>
                  <TableCell>{item.revenue.toFixed(2)}</TableCell>
                  <TableCell>{item.discount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No items sold.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
