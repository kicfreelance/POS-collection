import { notFound, redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { ShiftReportView } from "./shift-report-view";

export default async function ShiftReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { rows: shiftRows } = await pool.query<{
    id: string;
    cashier_id: string;
    cashier_name: string;
    opened_at: string;
    closed_at: string | null;
    opening_cash: string;
    closing_cash: string | null;
    expected_cash: string | null;
    cash_variance: string | null;
    status: string;
  }>(
    `SELECT s.id, s.cashier_id, u.full_name AS cashier_name, s.opened_at, s.closed_at, s.opening_cash,
            s.closing_cash, s.expected_cash, s.cash_variance, s.status
     FROM shifts s JOIN users u ON u.id = s.cashier_id
     WHERE s.id = $1`,
    [id],
  );
  const shift = shiftRows[0];
  if (!shift) notFound();

  const isOwnShift = shift.cashier_id === user.id;
  if (!isOwnShift && !hasPermission(user, "reports.view")) {
    redirect("/");
  }

  const { rows: items } = await pool.query<{
    product_name: string;
    quantity: string;
    revenue: string;
    discount: string;
  }>(
    `SELECT product_name, SUM(quantity) AS quantity, SUM(line_total) AS revenue, SUM(line_discount) AS discount
     FROM sale_items
     WHERE sale_id IN (SELECT id FROM sales WHERE shift_id = $1)
     GROUP BY product_name
     ORDER BY revenue DESC`,
    [id],
  );

  const { rows: summaryRows } = await pool.query<{
    gross: string;
    discount_total: string;
    tax_total: string;
    net: string;
    sale_count: string;
  }>(
    `SELECT COALESCE(SUM(subtotal), 0) AS gross, COALESCE(SUM(discount_total), 0) AS discount_total,
            COALESCE(SUM(tax_total), 0) AS tax_total, COALESCE(SUM(total), 0) AS net,
            COUNT(*) AS sale_count
     FROM sales WHERE shift_id = $1 AND status = 'completed'`,
    [id],
  );
  const summary = summaryRows[0];

  const { rows: paymentRows } = await pool.query<{ method: string; amount: string }>(
    `SELECT sp.method, SUM(sp.amount) AS amount
     FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id
     WHERE s.shift_id = $1
     GROUP BY sp.method`,
    [id],
  );

  return (
    <ShiftReportView
      shift={{
        cashierName: shift.cashier_name,
        openedAt: shift.opened_at,
        closedAt: shift.closed_at,
        openingCash: Number(shift.opening_cash),
        closingCash: shift.closing_cash != null ? Number(shift.closing_cash) : null,
        expectedCash: shift.expected_cash != null ? Number(shift.expected_cash) : null,
        variance: shift.cash_variance != null ? Number(shift.cash_variance) : null,
        status: shift.status,
      }}
      items={items.map((i) => ({
        productName: i.product_name,
        quantity: Number(i.quantity),
        revenue: Number(i.revenue),
        discount: Number(i.discount),
      }))}
      summary={{
        gross: Number(summary.gross),
        discountTotal: Number(summary.discount_total),
        taxTotal: Number(summary.tax_total),
        net: Number(summary.net),
        saleCount: Number(summary.sale_count),
      }}
      payments={paymentRows.map((p) => ({ method: p.method, amount: Number(p.amount) }))}
    />
  );
}
