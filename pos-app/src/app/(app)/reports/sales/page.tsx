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
import { SalesReportExport } from "./export-button";

export const dynamic = "force-dynamic";

const TRUNC: Record<string, string> = { daily: "day", weekly: "week", monthly: "month" };

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; groupBy?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "reports.view")) {
    redirect("/");
  }

  const { from, to, groupBy } = parseDateRange(await searchParams);
  const trunc = TRUNC[groupBy] ?? "day";

  const { rows } = await pool.query<{
    period: string;
    gross: string;
    discount_total: string;
    tax_total: string;
    net: string;
    sale_count: string;
  }>(
    `SELECT date_trunc($1, created_at) AS period,
            SUM(subtotal) AS gross, SUM(discount_total) AS discount_total,
            SUM(tax_total) AS tax_total, SUM(total) AS net, COUNT(*) AS sale_count
     FROM sales
     WHERE status = 'completed' AND created_at >= $2::date AND created_at < ($3::date + interval '1 day')
     GROUP BY period
     ORDER BY period`,
    [trunc, from, to],
  );

  const grandTotal = rows.reduce((sum, r) => sum + Number(r.net), 0);

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Report</h1>
          <p className="text-sm text-muted-foreground">Gross, discounts, tax, and net sales over time.</p>
        </div>
        <SalesReportExport rows={rows} />
      </div>

      <DateRangeFilter showGroupBy />

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Discounts</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.period}>
                  <TableCell className="font-medium">
                    {new Date(row.period).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{row.sale_count}</TableCell>
                  <TableCell>{Number(row.gross).toFixed(2)}</TableCell>
                  <TableCell>{Number(row.discount_total).toFixed(2)}</TableCell>
                  <TableCell>{Number(row.tax_total).toFixed(2)}</TableCell>
                  <TableCell className="font-semibold">{Number(row.net).toFixed(2)}</TableCell>
                </TableRow>
              ))}
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
            <p className="mt-4 text-right text-sm text-muted-foreground">
              Total net sales: <span className="font-semibold text-foreground">{grandTotal.toFixed(2)}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
