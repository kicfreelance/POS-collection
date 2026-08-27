"use client";

import { CsvExportButton } from "@/components/csv-export-button";

interface MovementRow {
  name: string;
  baseUnit: string;
  received: number;
  sold: number;
  adjusted: number;
}

export function StockMovementExport({ rows }: { rows: MovementRow[] }) {
  return (
    <CsvExportButton
      filename="stock-movement.csv"
      rows={rows.map((r) => ({
        product: r.name,
        unit: r.baseUnit,
        received: r.received.toFixed(3),
        sold: r.sold.toFixed(3),
        adjusted: r.adjusted.toFixed(3),
        net_change: (r.received - r.sold + r.adjusted).toFixed(3),
      }))}
    />
  );
}
