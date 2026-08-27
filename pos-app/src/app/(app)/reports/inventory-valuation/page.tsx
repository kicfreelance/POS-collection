import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InventoryValuationExport } from "./export-button";

export const dynamic = "force-dynamic";

export default async function InventoryValuationPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "reports.view")) {
    redirect("/");
  }

  const { rows } = await pool.query<{
    product_id: string;
    name: string;
    base_unit: string;
    qty_on_hand: string;
    value: string;
  }>(
    `SELECT p.id AS product_id, p.name, p.base_unit,
            COALESCE(SUM(b.quantity_remaining), 0) AS qty_on_hand,
            COALESCE(SUM(b.quantity_remaining * b.cost_price), 0) AS value
     FROM products p
     LEFT JOIN batches b ON b.product_id = p.id
     WHERE p.is_active = true
     GROUP BY p.id, p.name, p.base_unit
     HAVING COALESCE(SUM(b.quantity_remaining), 0) > 0
     ORDER BY value DESC`,
  );

  const totalValue = rows.reduce((sum, r) => sum + Number(r.value), 0);

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory Valuation</h1>
          <p className="text-sm text-muted-foreground">Current stock value at batch cost, as of now.</p>
        </div>
        <InventoryValuationExport rows={rows} />
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Qty on hand</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.product_id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    {Number(row.qty_on_hand).toFixed(3)} {row.base_unit}
                  </TableCell>
                  <TableCell>{Number(row.value).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No stock on hand.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {rows.length > 0 && (
            <p className="mt-4 text-right text-sm text-muted-foreground">
              Total inventory value: <span className="font-semibold text-foreground">{totalValue.toFixed(2)}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
