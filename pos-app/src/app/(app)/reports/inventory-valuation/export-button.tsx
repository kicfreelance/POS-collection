"use client";

import { CsvExportButton } from "@/components/csv-export-button";

interface ValuationRow {
  product_id: string;
  name: string;
  base_unit: string;
  qty_on_hand: string;
  value: string;
}

export function InventoryValuationExport({ rows }: { rows: ValuationRow[] }) {
  return (
    <CsvExportButton
      filename="inventory-valuation.csv"
      rows={rows.map((r) => ({
        product: r.name,
        qty_on_hand: Number(r.qty_on_hand).toFixed(3),
        unit: r.base_unit,
        value: Number(r.value).toFixed(2),
      }))}
    />
  );
}
