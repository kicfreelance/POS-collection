"use client";

import { CsvExportButton } from "@/components/csv-export-button";

interface SalesRow {
  period: string;
  gross: string;
  discount_total: string;
  tax_total: string;
  net: string;
  sale_count: string;
}

export function SalesReportExport({ rows }: { rows: SalesRow[] }) {
  return (
    <CsvExportButton
      filename="sales-report.csv"
      rows={rows.map((r) => ({
        period: new Date(r.period).toISOString().slice(0, 10),
        sales: r.sale_count,
        gross: Number(r.gross).toFixed(2),
        discounts: Number(r.discount_total).toFixed(2),
        tax: Number(r.tax_total).toFixed(2),
        net: Number(r.net).toFixed(2),
      }))}
    />
  );
}
