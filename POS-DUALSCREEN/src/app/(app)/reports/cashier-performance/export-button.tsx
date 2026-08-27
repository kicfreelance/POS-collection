"use client";

import { CsvExportButton } from "@/components/csv-export-button";

interface CashierRow {
  cashier_name: string;
  sale_count: string;
  net_sales: string;
  avg_sale: string;
  shifts_worked: string;
  avg_variance: string;
}

export function CashierPerformanceExport({ rows }: { rows: CashierRow[] }) {
  return (
    <CsvExportButton
      filename="cashier-performance.csv"
      rows={rows.map((r) => ({
        cashier: r.cashier_name,
        sales: r.sale_count,
        net_total: Number(r.net_sales).toFixed(2),
        avg_sale: Number(r.avg_sale).toFixed(2),
        shifts: r.shifts_worked,
        avg_variance: Number(r.avg_variance).toFixed(2),
      }))}
    />
  );
}
