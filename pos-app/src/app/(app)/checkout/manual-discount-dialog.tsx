"use client";

import { useState, type FormEvent } from "react";
import { Percent } from "lucide-react";
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
import { SupervisorPinModal } from "@/components/supervisor-pin-modal";
import { MANUAL_DISCOUNT_LIMIT_PERCENT } from "@/lib/promotions";
import type { ManualDiscountInput } from "./actions";

export function ManualDiscountDialog({
  canOverrideLimit,
  currentDiscount,
  onApply,
  onClear,
}: {
  canOverrideLimit: boolean;
  currentDiscount: ManualDiscountInput | null;
  onApply: (discount: ManualDiscountInput) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"percentage" | "flat">(currentDiscount?.type ?? "percentage");
  const [value, setValue] = useState(currentDiscount ? String(currentDiscount.value) : "");
  const [pendingApproval, setPendingApproval] = useState(false);

  function needsApproval(): boolean {
    if (canOverrideLimit) return false;
    if (type === "percentage") return Number(value) > MANUAL_DISCOUNT_LIMIT_PERCENT;
    return false; // flat amounts are checked server-side against the running total
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!value || Number(value) <= 0) return;

    if (needsApproval()) {
      setPendingApproval(true);
      return;
    }

    onApply({ type, value: Number(value) });
    setOpen(false);
  }

  function handleApproved(_approverName: string, approvalToken: string) {
    void _approverName;
    onApply({ type, value: Number(value), approvalToken });
    setPendingApproval(false);
    setOpen(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm">
              <Percent /> {currentDiscount ? "Edit discount" : "Discount"}
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual discount</DialogTitle>
            <DialogDescription>Applied to the whole cart, after product and promotion discounts.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => v && setType(v as "percentage" | "flat")}>
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
                <Label htmlFor="discount-value">Value</Label>
                <Input
                  id="discount-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            {!canOverrideLimit && type === "percentage" && Number(value) > MANUAL_DISCOUNT_LIMIT_PERCENT && (
              <p className="text-xs text-amber-500">
                Discounts above {MANUAL_DISCOUNT_LIMIT_PERCENT}% need supervisor approval.
              </p>
            )}
            <DialogFooter>
              {currentDiscount && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onClear();
                    setValue("");
                    setOpen(false);
                  }}
                >
                  Remove discount
                </Button>
              )}
              <Button type="submit" disabled={!value || Number(value) <= 0}>
                Apply
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SupervisorPinModal
        open={pendingApproval}
        permission="discounts.override_limit"
        reason={`This ${value}% discount exceeds the ${MANUAL_DISCOUNT_LIMIT_PERCENT}% limit and needs supervisor approval.`}
        onApprove={handleApproved}
        onCancel={() => setPendingApproval(false)}
      />
    </>
  );
}
