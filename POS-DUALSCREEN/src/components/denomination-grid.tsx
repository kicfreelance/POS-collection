"use client";

import { Input } from "@/components/ui/input";
import { CASH_DENOMINATIONS, totalFromCounts } from "@/lib/denominations";

export function DenominationGrid({
  counts,
  onChange,
}: {
  counts: Record<string, number>;
  onChange: (counts: Record<string, number>) => void;
}) {
  const total = totalFromCounts(counts);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {CASH_DENOMINATIONS.map((denom) => (
          <div key={denom} className="grid gap-1">
            <label className="text-xs text-muted-foreground">{denom}</label>
            <Input
              type="number"
              min="0"
              step="1"
              value={counts[denom] ?? ""}
              onChange={(e) =>
                onChange({ ...counts, [denom]: e.target.value ? Number(e.target.value) : 0 })
              }
              className="h-9 text-sm"
              placeholder="0"
            />
          </div>
        ))}
      </div>
      <div className="flex items-baseline justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-2">
        <span className="text-sm text-muted-foreground">Counted total</span>
        <span className="text-xl font-bold">{total.toFixed(2)}</span>
      </div>
    </div>
  );
}
