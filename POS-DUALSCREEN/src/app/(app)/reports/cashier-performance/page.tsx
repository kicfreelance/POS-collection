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
import { CashierPerformanceExport } from "./export-button";

export const dynamic = "force-dynamic";

export default async function CashierPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "reports.view")) {
    redirect("/");
  }

  const { from, to } = parseDateRange(await searchParams);

  const { rows } = await pool.query<{
    cashier_name: string;
    sale_count: string;
    net_sales: string;
    avg_sale: string;
    shifts_worked: string;
    avg_variance: string;
  }>(
    `SELECT u.full_name AS cashier_name,
            COUNT(DISTINCT s.id) AS sale_count,
            COALESCE(SUM(s.total), 0) AS net_sales,
            COALESCE(AVG(s.total), 0) AS avg_sale,
            COUNT(DISTINCT sh.id) AS shifts_worked,
            COALESCE(AVG(sh.cash_variance), 0) AS avg_variance
     FROM users u
     LEFT JOIN sales s ON s.cashier_id = u.id AND s.status = 'completed'
       AND s.created_at >= $1::date AND s.created_at < ($2::date + interval '1 day')
     LEFT JOIN shifts sh ON sh.cashier_id = u.id AND sh.status = 'closed'
       AND sh.opened_at >= $1::date AND sh.opened_at < ($2::date + interval '1 day')
     GROUP BY u.id, u.full_name
     HAVING COUNT(DISTINCT s.id) > 0 OR COUNT(DISTINCT sh.id) > 0
     ORDER BY net_sales DESC`,
    [from, to],
  );

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cashier Performance</h1>
          <p className="text-sm text-muted-foreground">Sales totals and cash variance by cashier.</p>
        </div>
        <CashierPerformanceExport rows={rows} />
      </div>

      <DateRangeFilter />

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cashier</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Net total</TableHead>
                <TableHead>Avg sale</TableHead>
                <TableHead>Shifts</TableHead>
                <TableHead>Avg variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.cashier_name}>
                  <TableCell className="font-medium">{row.cashier_name}</TableCell>
                  <TableCell>{row.sale_count}</TableCell>
                  <TableCell>{Number(row.net_sales).toFixed(2)}</TableCell>
                  <TableCell>{Number(row.avg_sale).toFixed(2)}</TableCell>
                  <TableCell>{row.shifts_worked}</TableCell>
                  <TableCell
                    className={
                      Number(row.avg_variance) === 0
                        ? ""
                        : Number(row.avg_variance) > 0
                          ? "text-emerald-500"
                          : "text-destructive"
                    }
                  >
                    {Number(row.avg_variance).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No activity in this range.
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
