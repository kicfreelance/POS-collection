"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ManualDiscountDialog } from "./manual-discount-dialog";
import { checkCoupon, type ManualDiscountInput, type SaleResult } from "./actions";
import { completeRestaurantOrder, getOrderForPayment, type OrderForPayment } from "./restaurant-actions";

const DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 1];

export function CompleteOrderDialog({
  orderId,
  open,
  onOpenChange,
  canOverrideDiscountLimit,
  canApplyDiscount,
  currencySymbol,
  onSuccess,
}: {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canOverrideDiscountLimit: boolean;
  canApplyDiscount: boolean;
  currencySymbol: string;
  onSuccess: (result: SaleResult) => void;
}) {
  const [order, setOrder] = useState<OrderForPayment | null>(null);
  const [loadError, setLoadError] = useState<{ forOrderId: string; message: string } | null>(null);
  const [cash, setCash] = useState("");
  const [card, setCard] = useState("");
  const [credit, setCredit] = useState("");
  const [manualDiscount, setManualDiscount] = useState<ManualDiscountInput | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loading = open && orderId != null && order?.id !== orderId && loadError?.forOrderId !== orderId;
  const error = orderId && loadError?.forOrderId === orderId ? loadError.message : submitError;

  useEffect(() => {
    if (!open || !orderId) return;
    let cancelled = false;
    getOrderForPayment(orderId)
      .then((result) => {
        if (cancelled) return;
        setOrder(result);
        setSubmitError(null);
        setCash("");
        setCard("");
        setCredit("");
        setManualDiscount(null);
        setCoupon(null);
        setCouponInput("");
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError({ forOrderId: orderId, message: err instanceof Error ? err.message : "Failed to load order" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  const preManualTotal = order?.total ?? 0;
  const manualDiscountAmount = manualDiscount
    ? Math.min(
        manualDiscount.type === "percentage"
          ? preManualTotal * (manualDiscount.value / 100)
          : manualDiscount.value,
        preManualTotal,
      )
    : 0;
  const afterManual = preManualTotal - manualDiscountAmount;
  const couponDiscountAmount = coupon ? Math.min(coupon.discountAmount, afterManual) : 0;
  const total = Math.max(0, afterManual - couponDiscountAmount);

  const cashAmount = Number(cash) || 0;
  const cardAmount = Number(card) || 0;
  const creditAmount = order?.isCreditCustomer ? Number(credit) || 0 : 0;
  const paid = cashAmount + cardAmount + creditAmount;
  const remaining = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);
  const canSubmit = Boolean(order) && paid >= total - 0.001 && !submitting;

  function addDenomination(value: number) {
    setCash((prev) => ((Number(prev) || 0) + value).toString());
  }

  function chargeExactCash() {
    setCash(Math.max(0, total - cardAmount - creditAmount).toFixed(2));
  }

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setCouponChecking(true);
    try {
      const result = await checkCoupon(couponInput.trim(), afterManual);
      if (!result.valid) {
        toast.error(result.error);
        return;
      }
      setCoupon({ code: couponInput.trim(), discountAmount: result.discountAmount });
    } finally {
      setCouponChecking(false);
    }
  }

  async function handleConfirm() {
    if (!orderId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payments = [];
      if (cashAmount > 0) payments.push({ method: "cash" as const, amount: cashAmount });
      if (cardAmount > 0) payments.push({ method: "card" as const, amount: cardAmount });
      if (creditAmount > 0) payments.push({ method: "credit" as const, amount: creditAmount });
      const result = await completeRestaurantOrder(orderId, payments, {
        manualDiscount,
        couponCode: coupon?.code ?? null,
      });
      onSuccess(result);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete &amp; pay</DialogTitle>
          <DialogDescription>
            {order ? `${order.orderNumber} — total due ${currencySymbol}${total.toFixed(2)}` : "Loading order..."}
            {order?.customerName ? ` — ${order.customerName}` : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
        ) : order ? (
          <div className="grid gap-4">
            {canApplyDiscount && (
              <div className="flex items-center gap-2">
                <ManualDiscountDialog
                  canOverrideLimit={canOverrideDiscountLimit}
                  currentDiscount={manualDiscount}
                  onApply={setManualDiscount}
                  onClear={() => setManualDiscount(null)}
                />
                {!coupon ? (
                  <div className="flex flex-1 gap-1.5">
                    <Input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="Coupon code"
                      className="h-8 text-sm"
                    />
                    <Button size="sm" variant="outline" disabled={couponChecking} onClick={applyCoupon}>
                      Apply
                    </Button>
                  </div>
                ) : (
                  <Badge variant="secondary" className="flex-1 justify-between">
                    {coupon.code}
                    <button type="button" onClick={() => setCoupon(null)} className="ml-2">
                      ×
                    </button>
                  </Badge>
                )}
              </div>
            )}

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="order-cash">Cash</Label>
                <button type="button" onClick={chargeExactCash} className="text-xs text-primary hover:underline">
                  Charge exact cash
                </button>
              </div>
              <Input
                id="order-cash"
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
                <Button key={d} type="button" variant="outline" size="sm" onClick={() => addDenomination(d)}>
                  +{d}
                </Button>
              ))}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="order-card">Card</Label>
              <Input
                id="order-card"
                type="number"
                min="0"
                step="0.01"
                value={card}
                onChange={(e) => setCard(e.target.value)}
                className="text-lg"
              />
            </div>

            {order.isCreditCustomer && (
              <div className="grid gap-1.5">
                <Label htmlFor="order-credit">Credit ({order.customerName})</Label>
                <Input
                  id="order-credit"
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
        ) : (
          <p className="py-6 text-center text-sm text-destructive">{error ?? "Order not found"}</p>
        )}

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
