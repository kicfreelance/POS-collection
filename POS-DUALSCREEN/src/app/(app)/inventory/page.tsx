import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdjustDialog, type BatchOption } from "./adjust-dialog";

export default async function InventoryPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "inventory.view")) {
    redirect("/");
  }
  const canAdjust = hasPermission(user, "inventory.adjust");

  const [{ rows: products }, { rows: batches }] = await Promise.all([
    pool.query<{
      id: string;
      name: string;
      sku: string;
      base_unit: string;
      reorder_threshold: string;
      quantity_on_hand: string;
    }>(
      `SELECT p.id, p.name, p.sku, p.base_unit, p.reorder_threshold,
              COALESCE(SUM(b.quantity_remaining), 0) AS quantity_on_hand
       FROM products p
       LEFT JOIN batches b ON b.product_id = p.id
       WHERE p.is_active = true
       GROUP BY p.id
       ORDER BY p.name`,
    ),
    pool.query<{ id: string; product_id: string; batch_number: string; quantity_remaining: string }>(
      `SELECT id, product_id, batch_number, quantity_remaining FROM batches
       WHERE quantity_remaining > 0 ORDER BY received_date`,
    ),
  ]);

  const batchesByProduct = new Map<string, BatchOption[]>();
  for (const batch of batches) {
    if (!batchesByProduct.has(batch.product_id)) batchesByProduct.set(batch.product_id, []);
    batchesByProduct.get(batch.product_id)?.push(batch);
  }

  const lowCount = products.filter(
    (p) => Number(p.quantity_on_hand) <= Number(p.reorder_threshold) && Number(p.quantity_on_hand) > 0,
  ).length;
  const outCount = products.filter((p) => Number(p.quantity_on_hand) <= 0).length;

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-8 flex items-center justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Live stock levels across all batches.</p>
        </div>
        <div className="flex gap-2">
          {outCount > 0 && <Badge variant="destructive">{outCount} out of stock</Badge>}
          {lowCount > 0 && (
            <Badge className="border-transparent bg-amber-500/15 text-amber-500">
              {lowCount} low stock
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>On hand</TableHead>
                <TableHead>Reorder at</TableHead>
                <TableHead>Status</TableHead>
                {canAdjust && <TableHead className="w-28" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const onHand = Number(product.quantity_on_hand);
                const threshold = Number(product.reorder_threshold);
                const status =
                  onHand <= 0 ? "out" : onHand <= threshold ? "low" : "ok";
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-muted-foreground">{product.sku}</TableCell>
                    <TableCell>
                      {onHand.toFixed(3)} {product.base_unit}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {threshold.toFixed(3)} {product.base_unit}
                    </TableCell>
                    <TableCell>
                      {status === "out" && <Badge variant="destructive">Out of stock</Badge>}
                      {status === "low" && (
                        <Badge className="border-transparent bg-amber-500/15 text-amber-500">
                          Low stock
                        </Badge>
                      )}
                      {status === "ok" && (
                        <Badge className="border-transparent bg-emerald-500/15 text-emerald-500">
                          In stock
                        </Badge>
                      )}
                    </TableCell>
                    {canAdjust && (
                      <TableCell>
                        <AdjustDialog
                          productId={product.id}
                          productName={product.name}
                          baseUnit={product.base_unit}
                          batches={batchesByProduct.get(product.id) ?? []}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
