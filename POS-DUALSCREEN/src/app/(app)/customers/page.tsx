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
import { CustomerDialog } from "./customer-dialog";

export default async function CustomersPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "customers.view")) {
    redirect("/");
  }
  const canManage = hasPermission(user, "customers.manage");

  const { rows: customers } = await pool.query<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    is_credit_customer: boolean;
    credit_limit: string | null;
    outstanding: string;
  }>(
    `SELECT c.id, c.name, c.phone, c.email, c.address, c.is_credit_customer, c.credit_limit,
            COALESCE(credit_sales.total, 0) - COALESCE(payments.total, 0) AS outstanding
     FROM customers c
     LEFT JOIN (
       SELECT s.customer_id, SUM(sp.amount) AS total
       FROM sales s JOIN sale_payments sp ON sp.sale_id = s.id
       WHERE sp.method = 'credit'
       GROUP BY s.customer_id
     ) credit_sales ON credit_sales.customer_id = c.id
     LEFT JOIN (
       SELECT customer_id, SUM(amount) AS total FROM credit_payments GROUP BY customer_id
     ) payments ON payments.customer_id = c.id
     ORDER BY c.name`,
  );

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-8 flex items-center justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Registered and credit customers.{" "}
            <Link href="/customers/credit-report" className="text-primary hover:underline">
              View credit report
            </Link>
          </p>
        </div>
        {canManage && <CustomerDialog />}
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead>Outstanding</TableHead>
                {canManage && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    <Link href={`/customers/${customer.id}`} className="hover:underline">
                      {customer.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{customer.phone ?? "—"}</TableCell>
                  <TableCell>
                    {customer.is_credit_customer ? (
                      <Badge variant="secondary">
                        Credit{customer.credit_limit ? ` (limit ${Number(customer.credit_limit).toFixed(2)})` : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Regular</Badge>
                    )}
                  </TableCell>
                  <TableCell className={Number(customer.outstanding) > 0 ? "text-amber-500" : "text-muted-foreground"}>
                    {Number(customer.outstanding).toFixed(2)}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <CustomerDialog
                        customer={{
                          id: customer.id,
                          name: customer.name,
                          phone: customer.phone,
                          email: customer.email,
                          address: customer.address,
                          is_credit_customer: customer.is_credit_customer,
                          credit_limit: customer.credit_limit,
                        }}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No customers yet.
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
