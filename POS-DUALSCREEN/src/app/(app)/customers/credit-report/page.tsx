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

interface AgedRow {
  customerId: string;
  name: string;
  current: number;
  d30: number;
  d60: number;
  d60plus: number;
  total: number;
}

export default async function CreditReportPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "reports.view")) {
    redirect("/");
  }

  const { rows: customers } = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM customers WHERE is_credit_customer = true ORDER BY name`,
  );

  const { rows: sales } = await pool.query<{
    customer_id: string;
    created_at: string;
    amount: string;
  }>(
    `SELECT s.customer_id, s.created_at, sp.amount
     FROM sales s JOIN sale_payments sp ON sp.sale_id = s.id
     WHERE sp.method = 'credit' AND s.customer_id IS NOT NULL
     ORDER BY s.customer_id, s.created_at ASC`,
  );

  const { rows: payments } = await pool.query<{ customer_id: string; amount: string }>(
    `SELECT customer_id, SUM(amount) AS amount FROM credit_payments GROUP BY customer_id`,
  );
  const paidByCustomer = new Map(payments.map((p) => [p.customer_id, Number(p.amount)]));

  // eslint-disable-next-line react-hooks/purity -- Server Component, evaluated once per request
  const now = Date.now();
  const rows: AgedRow[] = [];

  for (const customer of customers) {
    let remainingPayment = paidByCustomer.get(customer.id) ?? 0;
    const bucket = { current: 0, d30: 0, d60: 0, d60plus: 0 };

    const customerSales = sales.filter((s) => s.customer_id === customer.id);
    for (const sale of customerSales) {
      let saleAmount = Number(sale.amount);
      if (remainingPayment > 0) {
        const applied = Math.min(remainingPayment, saleAmount);
        saleAmount -= applied;
        remainingPayment -= applied;
      }
      if (saleAmount <= 0) continue;

      const ageDays = (now - new Date(sale.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays <= 30) bucket.current += saleAmount;
      else if (ageDays <= 60) bucket.d30 += saleAmount;
      else bucket.d60plus += saleAmount;
    }

    const total = bucket.current + bucket.d30 + bucket.d60 + bucket.d60plus;
    if (total > 0.001) {
      rows.push({ customerId: customer.id, name: customer.name, ...bucket, total });
    }
  }

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Credit Customer Aging</h1>
        <p className="text-sm text-muted-foreground">Outstanding balances by age of the originating sale.</p>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>0–30 days</TableHead>
                <TableHead>31–60 days</TableHead>
                <TableHead>60+ days</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.customerId}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.current.toFixed(2)}</TableCell>
                  <TableCell>{row.d30.toFixed(2)}</TableCell>
                  <TableCell className={row.d60plus > 0 ? "text-destructive" : ""}>
                    {row.d60plus.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-semibold">{row.total.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No outstanding credit balances.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {rows.length > 0 && (
            <p className="mt-4 text-right text-sm text-muted-foreground">
              Grand total outstanding: <span className="font-semibold text-foreground">{grandTotal.toFixed(2)}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
