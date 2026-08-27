"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DenominationGrid } from "@/components/denomination-grid";
import { SupervisorPinModal } from "@/components/supervisor-pin-modal";
import { totalFromCounts } from "@/lib/denominations";
import { closeShift } from "./actions";

export function EndShiftDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);

  async function submit(approvalToken?: string | null) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await closeShift(counts, approvalToken);
      toast.success(
        result.variance === 0
          ? "Shift closed — cash matched exactly"
          : `Shift closed — variance ${result.variance > 0 ? "+" : ""}${result.variance.toFixed(2)}`,
      );
      onOpenChange(false);
      setNeedsApproval(false);
      router.push(`/shifts/${result.shiftId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to close shift";
      if (message.includes("Supervisor approval")) {
        setNeedsApproval(true);
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>End shift</DialogTitle>
            <DialogDescription>Count the cash drawer to close your shift.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <DenominationGrid counts={counts} onChange={setCounts} />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={() => submit(null)}>
              {submitting ? "Closing..." : "Close shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SupervisorPinModal
        open={needsApproval}
        permission="shifts.override_cash"
        reason={`The cash count (${totalFromCounts(counts).toFixed(2)}) doesn't match the expected drawer total and needs supervisor approval.`}
        onApprove={(_name, token) => {
          void _name;
          submit(token);
        }}
        onCancel={() => setNeedsApproval(false)}
      />
    </>
  );
}
