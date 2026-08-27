import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export const dynamic = "force-dynamic";

export default async function PromotionsCouponsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "reports.view")) {
    redirect("/");
  }

  const { from, to } = parseDateRange(await searchParams);

  const [promoUsage, couponUsage] = await Promise.all([
    pool.query<{ name: string; times_used: string; total_discount: string }>(
      `SELECT pr.name, COUNT(si.id) AS times_used, COALESCE(SUM(si.line_discount), 0) AS total_discount
       FROM sale_items si
       JOIN promotions pr ON pr.id = si.promotion_id
       JOIN sales s ON s.id = si.sale_id
       WHERE s.status = 'completed' AND s.created_at >= $1::date AND s.created_at < ($2::date + interval '1 day')
       GROUP BY pr.id, pr.name
       ORDER BY total_discount DESC`,
      [from, to],
    ),
    pool.query<{ code: string; times_used: string; total_discount: string }>(
      `SELECT c.code, COUNT(cr.id) AS times_used, COALESCE(SUM(cr.discount_amount), 0) AS total_discount
       FROM coupon_redemptions cr
       JOIN coupons c ON c.id = cr.coupon_id
       JOIN sales s ON s.id = cr.sale_id
       WHERE s.status = 'completed' AND s.created_at >= $1::date AND s.created_at < ($2::date + interval '1 day')
       GROUP BY c.id, c.code
       ORDER BY total_discount DESC`,
      [from, to],
    ),
  ]);

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Promotions &amp; Coupons</h1>
        <p className="text-sm text-muted-foreground">Usage counts and total discount given.</p>
      </div>

      <DateRangeFilter />

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Promotions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Promotion</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Discount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoUsage.rows.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.times_used}</TableCell>
                    <TableCell>{Number(row.total_discount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {promoUsage.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No promotion usage.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coupons</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Discount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {couponUsage.rows.map((row) => (
                  <TableRow key={row.code}>
                    <TableCell className="font-mono text-xs">{row.code}</TableCell>
                    <TableCell>{row.times_used}</TableCell>
                    <TableCell>{Number(row.total_discount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {couponUsage.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No coupon usage.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
