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
import { DateRangeFilter } from "@/components/date-range-filter";
import { parseDateRange } from "@/lib/date-range";
import { StockMovementExport } from "./export-button";

export const dynamic = "force-dynamic";

interface MovementRow {
  name: string;
  baseUnit: string;
  received: number;
  sold: number;
  adjusted: number;
}

export default async function StockMovementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "reports.view")) {
    redirect("/");
  }

  const { from, to } = parseDateRange(await searchParams);

  const [products, received, sold, adjusted] = await Promise.all([
    pool.query<{ id: string; name: string; base_unit: string }>(
      `SELECT id, name, base_unit FROM products WHERE is_active = true`,
    ),
    pool.query<{ product_id: string; qty: string }>(
      `SELECT gi.product_id, SUM(gi.quantity) AS qty
       FROM grn_items gi JOIN grns g ON g.id = gi.grn_id
       WHERE g.received_date >= $1::date AND g.received_date < ($2::date + interval '1 day')
       GROUP BY gi.product_id`,
      [from, to],
    ),
    pool.query<{ product_id: string; qty: string }>(
      `SELECT si.product_id, SUM(sib.quantity) AS qty
       FROM sale_item_batches sib
       JOIN sale_items si ON si.id = sib.sale_item_id
       JOIN sales s ON s.id = si.sale_id
       WHERE s.status = 'completed' AND s.created_at >= $1::date AND s.created_at < ($2::date + interval '1 day')
       GROUP BY si.product_id`,
      [from, to],
    ),
    pool.query<{ product_id: string; qty: string }>(
      `SELECT product_id, SUM(quantity_delta) AS qty
       FROM stock_adjustments
       WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')
       GROUP BY product_id`,
      [from, to],
    ),
  ]);

  const receivedMap = new Map(received.rows.map((r) => [r.product_id, Number(r.qty)]));
  const soldMap = new Map(sold.rows.map((r) => [r.product_id, Number(r.qty)]));
  const adjustedMap = new Map(adjusted.rows.map((r) => [r.product_id, Number(r.qty)]));

  const rows: MovementRow[] = products.rows
    .map((p) => ({
      name: p.name,
      baseUnit: p.base_unit,
      received: receivedMap.get(p.id) ?? 0,
      sold: soldMap.get(p.id) ?? 0,
      adjusted: adjustedMap.get(p.id) ?? 0,
    }))
    .filter((r) => r.received !== 0 || r.sold !== 0 || r.adjusted !== 0);

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock Movement</h1>
          <p className="text-sm text-muted-foreground">Received, sold, and adjusted quantities by product.</p>
        </div>
        <StockMovementExport rows={rows} />
      </div>

      <DateRangeFilter />

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Sold</TableHead>
                <TableHead>Adjusted</TableHead>
                <TableHead>Net change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-emerald-500">
                    +{row.received.toFixed(3)} {row.baseUnit}
                  </TableCell>
                  <TableCell className="text-destructive">
                    -{row.sold.toFixed(3)} {row.baseUnit}
                  </TableCell>
                  <TableCell className={row.adjusted >= 0 ? "text-emerald-500" : "text-destructive"}>
                    {row.adjusted >= 0 ? "+" : ""}
                    {row.adjusted.toFixed(3)} {row.baseUnit}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {(row.received - row.sold + row.adjusted).toFixed(3)} {row.baseUnit}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No stock movement in this range.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
