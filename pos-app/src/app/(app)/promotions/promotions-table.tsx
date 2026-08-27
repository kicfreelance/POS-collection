"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deletePromotion, setPromotionActive } from "./actions";

export interface PromotionRow {
  id: string;
  name: string;
  type: string;
  target_type: string;
  target_name: string;
  is_active: boolean;
  start_at: string | null;
  end_at: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  percentage_off: "% off",
  flat_off: "Flat off",
  buy_x_get_y: "Buy X get Y",
  bundle: "Bundle",
};

export function PromotionsTable({ promotions }: { promotions: PromotionRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Applies to</TableHead>
          <TableHead>Window</TableHead>
          <TableHead>Active</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {promotions.map((promo) => (
          <PromoRow key={promo.id} promo={promo} />
        ))}
        {promotions.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              No promotions yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function PromoRow({ promo }: { promo: PromotionRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle(checked: boolean) {
    startTransition(async () => {
      try {
        await setPromotionActive(promo.id, checked);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update promotion");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deletePromotion(promo.id);
        toast.success(`"${promo.name}" deleted`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete promotion");
      }
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{promo.name}</TableCell>
      <TableCell>
        <Badge variant="outline">{TYPE_LABELS[promo.type] ?? promo.type}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {promo.target_type}: {promo.target_name}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {promo.start_at ? new Date(promo.start_at).toLocaleDateString() : "Always"}
        {promo.end_at ? ` – ${new Date(promo.end_at).toLocaleDateString()}` : ""}
      </TableCell>
      <TableCell>
        <Switch checked={promo.is_active} disabled={isPending} onCheckedChange={handleToggle} />
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          onClick={handleDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  );
}
