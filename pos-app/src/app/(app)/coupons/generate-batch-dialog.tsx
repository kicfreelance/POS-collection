"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCouponBatch } from "./actions";

function downloadCsv(codes: string[], batchLabel: string) {
  const csv = ["code", ...codes].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${batchLabel || "coupons"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function GenerateBatchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<string[] | null>(null);

  const [pattern, setPattern] = useState("SAVE-XXXX-XXXX");
  const [quantity, setQuantity] = useState("10");
  const [discountType, setDiscountType] = useState<"percentage" | "flat">("percentage");
  const [value, setValue] = useState("10");
  const [minPurchase, setMinPurchase] = useState("0");
  const [usageLimit, setUsageLimit] = useState("1");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [batchLabel, setBatchLabel] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const codes = await createCouponBatch({
          pattern,
          quantity: Number(quantity),
          discountType,
          value: Number(value),
          minPurchaseAmount: Number(minPurchase),
          usageLimit: usageLimit ? Number(usageLimit) : null,
          validFrom: validFrom || null,
          validUntil: validUntil || null,
          batchLabel: batchLabel || pattern,
        });
        setGeneratedCodes(codes);
        toast.success(`${codes.length} coupons generated`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate coupons");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setGeneratedCodes(null);
      }}
    >
      <DialogTrigger render={<Button><Plus /> Generate Coupons</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate coupon batch</DialogTitle>
          <DialogDescription>Use X as a placeholder for random characters.</DialogDescription>
        </DialogHeader>

        {generatedCodes ? (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              {generatedCodes.length} codes generated.
            </p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 p-3 font-mono text-xs">
              {generatedCodes.join(", ")}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadCsv(generatedCodes, batchLabel || pattern)}
              >
                <Download /> Download CSV
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="pattern">Pattern</Label>
                <Input id="pattern" value={pattern} onChange={(e) => setPattern(e.target.value)} required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max="5000"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Discount type</Label>
                <Select value={discountType} onValueChange={(v) => v && setDiscountType(v as "percentage" | "flat")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="flat">Flat amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="value">Value</Label>
                <Input id="value" type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="minPurchase">Min purchase</Label>
                <Input
                  id="minPurchase"
                  type="number"
                  min="0"
                  step="0.01"
                  value={minPurchase}
                  onChange={(e) => setMinPurchase(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="usageLimit">Usage limit (blank = unlimited)</Label>
                <Input
                  id="usageLimit"
                  type="number"
                  min="1"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Valid from</Label>
                <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Valid until</Label>
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="batchLabel">Batch label (optional)</Label>
              <Input id="batchLabel" value={batchLabel} onChange={(e) => setBatchLabel(e.target.value)} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Generating..." : "Generate"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
