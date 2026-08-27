"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { returnBatchToSupplier } from "../actions";

export function ReturnBatchDialog({
  batchId,
  productName,
  maxQuantity,
}: {
  batchId: string;
  productName: string;
  maxQuantity: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(maxQuantity);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await returnBatchToSupplier(batchId, quantity, reason);
        toast.success("Batch returned to supplier");
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to return batch");
      }
    });
  }

  if (maxQuantity <= 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm"><Undo2 /> Return</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return stock to supplier</DialogTitle>
          <DialogDescription>{productName} — up to {maxQuantity} available in this batch.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="return-qty">Quantity</Label>
            <Input
              id="return-qty"
              type="number"
              min="0.001"
              max={maxQuantity}
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="return-reason">Reason</Label>
            <Input id="return-reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending || quantity <= 0 || quantity > maxQuantity}>
              {isPending ? "Returning..." : "Return to supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
