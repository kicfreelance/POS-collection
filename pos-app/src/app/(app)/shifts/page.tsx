import Link from "next/link";
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

export default async function ShiftsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canViewAll = hasPermission(user, "reports.view");

  const { rows: shifts } = await pool.query<{
    id: string;
    cashier_name: string;
    opened_at: string;
    closed_at: string | null;
    status: string;
    cash_variance: string | null;
    net_sales: string;
  }>(
    `SELECT s.id, u.full_name AS cashier_name, s.opened_at, s.closed_at, s.status, s.cash_variance,
            COALESCE((SELECT SUM(total) FROM sales WHERE shift_id = s.id AND status = 'completed'), 0) AS net_sales
     FROM shifts s JOIN users u ON u.id = s.cashier_id
     WHERE $1 OR s.cashier_id = $2
     ORDER BY s.opened_at DESC
     LIMIT 100`,
    [canViewAll, user.id],
  );

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Shifts</h1>
        <p className="text-sm text-muted-foreground">
          {canViewAll ? "All cashier shifts." : "Your shift history."}
        </p>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cashier</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Closed</TableHead>
                <TableHead>Net sales</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell className="font-medium">
                    <Link href={`/shifts/${shift.id}`} className="hover:underline">
                      {shift.cashier_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(shift.opened_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {shift.closed_at ? new Date(shift.closed_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>{Number(shift.net_sales).toFixed(2)}</TableCell>
                  <TableCell>
                    {shift.cash_variance != null ? (
                      <span className={Number(shift.cash_variance) === 0 ? "" : "text-amber-500"}>
                        {Number(shift.cash_variance) > 0 ? "+" : ""}
                        {Number(shift.cash_variance).toFixed(2)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={shift.status === "open" ? "secondary" : "outline"}>{shift.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {shifts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No shifts yet.
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
