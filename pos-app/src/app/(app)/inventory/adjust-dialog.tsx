"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";
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
import { createStockAdjustment } from "./actions";

export interface BatchOption {
  id: string;
  batch_number: string;
  quantity_remaining: string;
}

export function AdjustDialog({
  productId,
  productName,
  baseUnit,
  batches,
}: {
  productId: string;
  productName: string;
  baseUnit: string;
  batches: BatchOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [direction, setDirection] = useState<"add" | "remove">("remove");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const qty = Number(quantity);
    if (!batchId) {
      setError("Select a batch");
      return;
    }
    if (!qty || qty <= 0) {
      setError("Enter a quantity greater than zero");
      return;
    }
    startTransition(async () => {
      try {
        await createStockAdjustment(
          productId,
          batchId,
          direction === "add" ? qty : -qty,
          reason,
        );
        toast.success("Stock adjusted");
        setOpen(false);
        setQuantity("");
        setReason("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to adjust stock");
      }
    });
  }

  if (batches.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm"><SlidersHorizontal /> Adjust</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock — {productName}</DialogTitle>
          <DialogDescription>Damages, expiry write-offs, or manual corrections.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Batch</Label>
            <Select value={batchId} onValueChange={(value) => setBatchId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select batch" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.batch_number} ({Number(batch.quantity_remaining).toFixed(3)} {baseUnit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Direction</Label>
              <Select value={direction} onValueChange={(value) => setDirection((value as "add" | "remove") ?? "remove")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="remove">Remove (damage/loss)</SelectItem>
                  <SelectItem value="add">Add (correction)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="adj-qty">Quantity ({baseUnit})</Label>
              <Input
                id="adj-qty"
                type="number"
                min="0"
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adj-reason">Reason</Label>
            <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Apply adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
