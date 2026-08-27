"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DenominationGrid } from "@/components/denomination-grid";
import { openShift } from "./actions";

export function StartShiftScreen() {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setSubmitting(true);
    setError(null);
    try {
      await openShift(counts);
      toast.success("Shift started");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start shift");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Start your shift</CardTitle>
          <CardDescription>Count the cash drawer to open a new shift.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <DenominationGrid counts={counts} onChange={setCounts} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="h-11 text-base" disabled={submitting} onClick={handleStart}>
            {submitting ? "Starting..." : "Start Shift"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
