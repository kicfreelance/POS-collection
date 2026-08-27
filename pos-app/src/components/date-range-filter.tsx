"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DateRangeFilter({ showGroupBy = false }: { showGroupBy?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const from = searchParams.get("from") ?? defaultFrom();
  const to = searchParams.get("to") ?? defaultTo();
  const groupBy = searchParams.get("groupBy") ?? "daily";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label className="text-xs">From</Label>
        <Input
          type="date"
          value={from}
          onChange={(e) => updateParam("from", e.target.value)}
          className="h-9 w-40"
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">To</Label>
        <Input
          type="date"
          value={to}
          onChange={(e) => updateParam("to", e.target.value)}
          className="h-9 w-40"
        />
      </div>
      {showGroupBy && (
        <div className="grid gap-1.5">
          <Label className="text-xs">Group by</Label>
          <Select value={groupBy} onValueChange={(v) => v && updateParam("groupBy", v)}>
            <SelectTrigger className="h-9 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push(pathname)}
        className="h-9"
      >
        Reset
      </Button>
    </div>
  );
}
