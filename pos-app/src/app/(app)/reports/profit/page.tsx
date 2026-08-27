import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { getBusinessSettings } from "@/lib/settings-server";
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
import { DateRangeFilter } from "@/components/date-range-filter";
import { parseDateRange } from "@/lib/date-range";
import { ProfitReportExport } from "./export-button";

export const dynamic = "force-dynamic";

export default async function ProfitReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "reports.view")) {
    redirect("/");
  }

  const { from, to } = parseDateRange(await searchParams);
  const settings = await getBusinessSettings();

  const { rows } = await pool.query<{
    product_id: string;
    name: string;
    qty: string;
    revenue: string;
    cogs: string;
  }>(
    `WITH avg_cost AS (
       SELECT product_id, SUM(cost_price * quantity_received) / NULLIF(SUM(quantity_received), 0) AS avg_cost
       FROM batches GROUP BY product_id
     )
     SELECT p.id AS product_id, p.name,
            SUM(sib.quantity) AS qty,
            SUM(si.line_subtotal - si.line_discount) AS revenue,
            CASE WHEN $1 = 'batch_fifo' THEN SUM(sib.quantity * sib.cost_price)
                 ELSE SUM(sib.quantity * COALESCE(ac.avg_cost, 0)) END AS cogs
     FROM sale_item_batches sib
     JOIN sale_items si ON si.id = sib.sale_item_id
     JOIN sales s ON s.id = si.sale_id
     JOIN products p ON p.id = si.product_id
     LEFT JOIN avg_cost ac ON ac.product_id = p.id
     WHERE s.status = 'completed' AND s.created_at >= $2::date AND s.created_at < ($3::date + interval '1 day')
     GROUP BY p.id, p.name
     ORDER BY revenue DESC`,
    [settings.costingMethod, from, to],
  );

  const totals = rows.reduce(
    (acc, r) => {
      acc.revenue += Number(r.revenue);
      acc.cogs += Number(r.cogs);
      return acc;
    },
    { revenue: 0, cogs: 0 },
  );
  const totalProfit = totals.revenue - totals.cogs;
  const totalMargin = totals.revenue > 0 ? (totalProfit / totals.revenue) * 100 : 0;

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profit &amp; Margin</h1>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            Costing method:
            <Badge variant="secondary">
              {settings.costingMethod === "batch_fifo" ? "Batch-wise (FIFO)" : "Weighted Average"}
            </Badge>
          </p>
        </div>
        <ProfitReportExport rows={rows} />
      </div>

      <DateRangeFilter />

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Qty sold</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>COGS</TableHead>
                <TableHead>Profit</TableHead>
                <TableHead>Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const revenue = Number(row.revenue);
                const cogs = Number(row.cogs);
                const profit = revenue - cogs;
                const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
                return (
                  <TableRow key={row.product_id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{Number(row.qty).toFixed(2)}</TableCell>
                    <TableCell>{revenue.toFixed(2)}</TableCell>
                    <TableCell>{cogs.toFixed(2)}</TableCell>
                    <TableCell className={profit >= 0 ? "text-emerald-500" : "text-destructive"}>
                      {profit.toFixed(2)}
                    </TableCell>
                    <TableCell>{margin.toFixed(1)}%</TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No sales in this range.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {rows.length > 0 && (
            <div className="mt-4 flex justify-end gap-6 text-sm text-muted-foreground">
              <span>
                Total profit: <span className="font-semibold text-foreground">{totalProfit.toFixed(2)}</span>
              </span>
              <span>
                Margin: <span className="font-semibold text-foreground">{totalMargin.toFixed(1)}%</span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
