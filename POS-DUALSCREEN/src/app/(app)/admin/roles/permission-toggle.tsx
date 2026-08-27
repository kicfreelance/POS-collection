"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function PermissionToggle({
  id,
  action,
  defaultChecked,
  label,
}: {
  id: string;
  action: () => Promise<void>;
  defaultChecked: boolean;
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange() {
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update permission");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        defaultChecked={defaultChecked}
        disabled={isPending}
        onCheckedChange={handleChange}
      />
      <Label htmlFor={id} className="text-sm font-normal text-muted-foreground">
        {label}
      </Label>
    </div>
  );
}
