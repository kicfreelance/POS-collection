"use client";

import { useState } from "react";
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
} from "@/components/ui/dialog";
import {
  createSale,
  type CartLineInput,
  type ManualDiscountInput,
  type SaleResult,
} from "./actions";

const DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 1];

export function PayDialog({
  open,
  onOpenChange,
  total,
  lines,
  manualDiscount,
  couponCode,
  customerId,
  customerName,
  isCreditCustomer,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  lines: CartLineInput[];
  manualDiscount: ManualDiscountInput | null;
  couponCode: string | null;
  customerId: string | null;
  customerName: string | null;
  isCreditCustomer: boolean;
  onSuccess: (result: SaleResult) => void;
}) {
  const [cash, setCash] = useState("");
  const [card, setCard] = useState("");
  const [credit, setCredit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cashAmount = Number(cash) || 0;
  const cardAmount = Number(card) || 0;
  const creditAmount = isCreditCustomer ? Number(credit) || 0 : 0;
  const paid = cashAmount + cardAmount + creditAmount;
  const remaining = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);
  const canSubmit = paid >= total - 0.001 && !submitting && lines.length > 0;

  function addDenomination(value: number) {
    setCash((prev) => ((Number(prev) || 0) + value).toString());
  }

  function chargeExactCash() {
    setCash(Math.max(0, total - cardAmount - creditAmount).toFixed(2));
  }

  function chargeRemainingToCredit() {
    setCredit(Math.max(0, total - cashAmount - cardAmount).toFixed(2));
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const payments = [];
      if (cashAmount > 0) payments.push({ method: "cash" as const, amount: cashAmount });
      if (cardAmount > 0) payments.push({ method: "card" as const, amount: cardAmount });
      if (creditAmount > 0) payments.push({ method: "credit" as const, amount: creditAmount });
      const result = await createSale(lines, payments, {
        manualDiscount,
        couponCode,
        customerId,
      });
      setCash("");
      setCard("");
      setCredit("");
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Take payment</DialogTitle>
          <DialogDescription>
            Total due: {total.toFixed(2)}
            {customerName ? ` — ${customerName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cash">Cash</Label>
              <button
                type="button"
                onClick={chargeExactCash}
                className="text-xs text-primary hover:underline"
              >
                Charge exact cash
              </button>
            </div>
            <Input
              id="cash"
              type="number"
              min="0"
              step="0.01"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              className="text-lg"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {DENOMINATIONS.map((d) => (
              <Button
                key={d}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addDenomination(d)}
              >
                +{d}
              </Button>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="card">Card</Label>
            <Input
              id="card"
              type="number"
              min="0"
              step="0.01"
              value={card}
              onChange={(e) => setCard(e.target.value)}
              className="text-lg"
            />
          </div>

          {isCreditCustomer && (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="credit">Credit ({customerName})</Label>
                <button
                  type="button"
                  onClick={chargeRemainingToCredit}
                  className="text-xs text-primary hover:underline"
                >
                  Charge remaining
                </button>
              </div>
              <Input
                id="credit"
                type="number"
                min="0"
                step="0.01"
                value={credit}
                onChange={(e) => setCredit(e.target.value)}
                className="text-lg"
              />
            </div>
          )}

          <div className="grid gap-1 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due</span>
              <span>{total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span>{paid.toFixed(2)}</span>
            </div>
            {remaining > 0 ? (
              <div className="flex justify-between font-medium text-amber-500">
                <span>Remaining</span>
                <span>{remaining.toFixed(2)}</span>
              </div>
            ) : (
              <div className="flex justify-between font-medium text-emerald-500">
                <span>Change</span>
                <span>{change.toFixed(2)}</span>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!canSubmit}>
            {submitting ? "Processing..." : "Confirm payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
