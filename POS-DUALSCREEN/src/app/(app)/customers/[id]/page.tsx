import { notFound, redirect } from "next/navigation";
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
import { RecordPaymentDialog } from "./record-payment-dialog";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "customers.view")) {
    redirect("/");
  }
  const canManageCredit = hasPermission(user, "customers.manage_credit");

  const { rows: customerRows } = await pool.query<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    is_credit_customer: boolean;
    credit_limit: string | null;
  }>(`SELECT * FROM customers WHERE id = $1`, [id]);
  const customer = customerRows[0];
  if (!customer) notFound();

  const [{ rows: creditSales }, { rows: payments }] = await Promise.all([
    pool.query<{ sale_number: string; created_at: string; amount: string }>(
      `SELECT s.sale_number, s.created_at, sp.amount
       FROM sales s JOIN sale_payments sp ON sp.sale_id = s.id
       WHERE s.customer_id = $1 AND sp.method = 'credit'
       ORDER BY s.created_at DESC`,
      [id],
    ),
    pool.query<{ amount: string; payment_method: string; created_at: string; notes: string | null }>(
      `SELECT amount, payment_method, created_at, notes FROM credit_payments WHERE customer_id = $1 ORDER BY created_at DESC`,
      [id],
    ),
  ]);

  const totalCredit = creditSales.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = totalCredit - totalPaid;

  return (
    <div className="mx-auto w-full max-w-3xl px-10 py-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            {customer.phone ?? "No phone"} {customer.email ? `· ${customer.email}` : ""}
          </p>
        </div>
        {customer.is_credit_customer && canManageCredit && <RecordPaymentDialog customerId={customer.id} />}
      </div>

      {customer.is_credit_customer && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Credit account
              {customer.credit_limit && <Badge variant="secondary">Limit {Number(customer.credit_limit).toFixed(2)}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total credit sales</p>
              <p className="text-lg font-semibold">{totalCredit.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total paid</p>
              <p className="text-lg font-semibold">{totalPaid.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Outstanding</p>
              <p className={`text-lg font-semibold ${outstanding > 0 ? "text-amber-500" : ""}`}>
                {outstanding.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credit sales</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditSales.map((sale, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-xs">
                      {sale.sale_number}
                      <div className="text-muted-foreground">
                        {new Date(sale.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>{Number(sale.amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {creditSales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No credit sales.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment history</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="capitalize">{payment.payment_method}</TableCell>
                    <TableCell>{Number(payment.amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No payments yet.
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
