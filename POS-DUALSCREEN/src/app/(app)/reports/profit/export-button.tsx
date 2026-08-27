"use client";

import { CsvExportButton } from "@/components/csv-export-button";

interface ProfitRow {
  product_id: string;
  name: string;
  qty: string;
  revenue: string;
  cogs: string;
}

export function ProfitReportExport({ rows }: { rows: ProfitRow[] }) {
  return (
    <CsvExportButton
      filename="profit-report.csv"
      rows={rows.map((r) => {
        const revenue = Number(r.revenue);
        const cogs = Number(r.cogs);
        return {
          product: r.name,
          qty: Number(r.qty).toFixed(2),
          revenue: revenue.toFixed(2),
          cogs: cogs.toFixed(2),
          profit: (revenue - cogs).toFixed(2),
          margin_pct: revenue > 0 ? (((revenue - cogs) / revenue) * 100).toFixed(1) : "0",
        };
      })}
    />
  );
}
