import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GenerateBatchDialog } from "./generate-batch-dialog";

export default async function CouponsPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "coupons.manage")) {
    redirect("/");
  }

  const [{ rows: batches }, { rows: coupons }] = await Promise.all([
    pool.query<{
      batch_label: string;
      count: string;
      redeemed: string;
      discount_type: string;
      value: string;
    }>(
      `SELECT batch_label, COUNT(*) AS count, SUM(times_used) AS redeemed,
              MIN(discount_type) AS discount_type, MIN(value) AS value
       FROM coupons GROUP BY batch_label ORDER BY MIN(created_at) DESC`,
    ),
    pool.query<{
      id: string;
      code: string;
      discount_type: string;
      value: string;
      times_used: number;
      usage_limit: number | null;
      is_active: boolean;
      batch_label: string;
    }>(`SELECT id, code, discount_type, value, times_used, usage_limit, is_active, batch_label
        FROM coupons ORDER BY created_at DESC LIMIT 200`),
  ]);

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-8 flex items-center justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Coupons</h1>
          <p className="text-sm text-muted-foreground">Bulk-generate voucher codes for distribution.</p>
        </div>
        <GenerateBatchDialog />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Batches</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Codes</TableHead>
                <TableHead>Redeemed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <TableRow key={batch.batch_label}>
                  <TableCell className="font-medium">{batch.batch_label}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {batch.discount_type === "percentage"
                      ? `${Number(batch.value)}%`
                      : Number(batch.value).toFixed(2)}
                  </TableCell>
                  <TableCell>{batch.count}</TableCell>
                  <TableCell>{batch.redeemed ?? 0}</TableCell>
                </TableRow>
              ))}
              {batches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No coupon batches yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent codes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell className="font-mono text-xs">{coupon.code}</TableCell>
                  <TableCell className="text-muted-foreground">{coupon.batch_label}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {coupon.times_used} / {coupon.usage_limit ?? "∞"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={coupon.is_active ? "secondary" : "outline"}>
                      {coupon.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
