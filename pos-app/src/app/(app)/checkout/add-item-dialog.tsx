"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CartLine, ProductForSale, SubUnitOption } from "./types";

const COUNT_UNITS = new Set(["pcs", "each", "unit"]);

export interface AddItemResult {
  unitCode: string;
  quantity: number;
  batchId: string | null;
  applyProductDiscount: boolean;
}

interface UnitChoice {
  code: string;
  name: string;
  factor: number; // 1 for the base unit
}

const AUTO_BATCH = "__auto__";

/**
 * Generic roving-tabindex radio group used for both the unit selector
 * (horizontal) and the batch picker (vertical). Fully keyboard driven.
 */
function RovingGroup({
  orientation,
  value,
  onChange,
  options,
  ariaLabel,
  className,
  renderOption,
}: {
  orientation: "horizontal" | "vertical";
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  className?: string;
  renderOption?: (o: { value: string; label: string }, selected: boolean) => React.ReactNode;
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function move(to: number) {
    const next = (to + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const prevKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
    if (e.key === prevKey) {
      e.preventDefault();
      move(activeIndex - 1);
    } else if (e.key === nextKey) {
      e.preventDefault();
      move(activeIndex + 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(0);
    } else if (e.key === "End") {
      e.preventDefault();
      move(options.length - 1);
    } else if (/^[1-9]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (i < options.length) {
        e.preventDefault();
        move(i);
      }
    } else if (e.key.length === 1 && /[a-z]/i.test(e.key)) {
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) {
        e.preventDefault();
        move(i);
      }
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(orientation === "horizontal" ? "flex flex-wrap gap-1.5" : "grid gap-1.5", className)}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={i === activeIndex ? 0 : -1}
            data-active={selected ? "" : undefined}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm outline-none transition",
              "focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary bg-primary/10 font-medium text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/30",
              orientation === "vertical" && "text-left",
            )}
          >
            {renderOption ? renderOption(o, selected) : o.label}
          </button>
        );
      })}
    </div>
  );
}

export function AddItemDialog({
  open,
  onOpenChange,
  product,
  editingLine,
  currencySymbol,
  taxInclusive,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductForSale;
  editingLine: CartLine | null;
  currencySymbol: string;
  taxInclusive: boolean;
  onSubmit: (r: AddItemResult) => void;
}) {
  const qtyRef = useRef<HTMLInputElement>(null);

  const unitChoices: UnitChoice[] = useMemo(
    () => [
      { code: product.baseUnit, name: product.baseUnitName, factor: 1 },
      ...product.subUnits.map((s: SubUnitOption) => ({ code: s.code, name: s.name, factor: s.factor })),
    ],
    [product],
  );

  const liveBatches = useMemo(
    () => product.batches.filter((b) => b.quantityRemaining > 0),
    [product.batches],
  );
  const showBatchPicker = liveBatches.length >= 2;
  const showDiscountToggle = product.discountType != null && product.discountValue != null;

  const [unitCode, setUnitCode] = useState<string>(
    () => editingLine?.unitCode ?? product.baseUnit,
  );
  const [quantity, setQuantity] = useState<string>(() =>
    editingLine ? String(editingLine.quantity) : "1",
  );
  const [batchId, setBatchId] = useState<string>(() => editingLine?.batchId ?? AUTO_BATCH);
  const [applyProductDiscount, setApplyProductDiscount] = useState<boolean>(
    () => editingLine?.applyProductDiscount ?? true,
  );

  const chosenUnit = unitChoices.find((u) => u.code === unitCode) ?? unitChoices[0];
  const isCount = COUNT_UNITS.has(chosenUnit.code);
  const step = isCount ? 1 : 0.01;
  const unitPrice = product.sellingPrice / chosenUnit.factor;
  const qtyNum = Number(quantity);
  const validQty = Number.isFinite(qtyNum) && qtyNum > 0;

  const lineSub = validQty ? unitPrice * qtyNum : 0;
  const rawDiscount =
    applyProductDiscount && product.discountType && product.discountValue
      ? product.discountType === "percentage"
        ? lineSub * (product.discountValue / 100)
        : product.discountValue
      : 0;
  const discount = Math.min(rawDiscount, lineSub);
  const net = lineSub - discount;
  const tax = taxInclusive
    ? net * (product.taxRate / (100 + product.taxRate))
    : net * (product.taxRate / 100);
  const lineTotalPreview = taxInclusive ? net : net + tax;

  function bump(delta: number) {
    const cur = Number.isFinite(qtyNum) ? qtyNum : 0;
    const next = Math.max(0, Math.round((cur + delta) * 1000) / 1000);
    setQuantity(String(next));
    qtyRef.current?.focus();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validQty) return;
    onSubmit({
      unitCode: chosenUnit.code,
      quantity: qtyNum,
      batchId: batchId === AUTO_BATCH ? null : batchId,
      applyProductDiscount,
    });
    onOpenChange(false);
  }

  const money = (n: number) => `${currencySymbol}${n.toFixed(2)}`;
  const batchOptions = [
    { value: AUTO_BATCH, label: "Auto (FIFO / oldest first)" },
    ...liveBatches.map((b) => ({
      value: b.id,
      label: `${b.batchNumber} · exp ${b.expiryDate ? b.expiryDate.slice(0, 10) : "—"} · ${b.quantityRemaining} ${product.baseUnitName}`,
    })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" initialFocus={qtyRef}>
        <DialogHeader>
          <DialogTitle>{editingLine ? "Edit item" : "Add item"}</DialogTitle>
          <DialogDescription>
            {product.name} · {product.sku} · {money(product.sellingPrice)} / {product.baseUnitName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4">
          {unitChoices.length > 1 && (
            <div className="grid gap-1.5">
              <Label>Unit</Label>
              <RovingGroup
                orientation="horizontal"
                ariaLabel="Unit"
                value={chosenUnit.code}
                onChange={setUnitCode}
                options={unitChoices.map((u) => ({ value: u.code, label: u.name }))}
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="add-item-qty">Quantity</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon-sm" onClick={() => bump(-step)}>
                <Minus />
              </Button>
              <Input
                id="add-item-qty"
                ref={qtyRef}
                type="number"
                inputMode="decimal"
                min={0}
                step={step}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-11 w-28 text-center text-lg"
              />
              <Button type="button" variant="outline" size="icon-sm" onClick={() => bump(step)}>
                <Plus />
              </Button>
              <span className="text-sm text-muted-foreground">{chosenUnit.name}</span>
            </div>
          </div>

          {showBatchPicker && (
            <div className="grid gap-1.5">
              <Label>Batch</Label>
              <RovingGroup
                orientation="vertical"
                ariaLabel="Batch"
                value={batchId}
                onChange={setBatchId}
                options={batchOptions}
              />
            </div>
          )}

          {showDiscountToggle && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={applyProductDiscount}
                onCheckedChange={(v) => setApplyProductDiscount(Boolean(v))}
              />
              Keep product discount (
              {product.discountType === "percentage"
                ? `−${product.discountValue}%`
                : `−${money(product.discountValue ?? 0)}`}
              )
            </label>
          )}

          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {validQty ? `${qtyNum} ${chosenUnit.name} × ${money(unitPrice)}` : "—"}
              </span>
              <span className="font-semibold">Line total {money(lineTotalPreview)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!validQty}>
              {editingLine ? "Update line" : "Add to cart"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
