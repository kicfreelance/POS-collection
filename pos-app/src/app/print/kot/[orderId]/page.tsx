import { notFound, redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/rbac";
import { getBusinessSettings } from "@/lib/settings-server";
import { KotView } from "./kot-view";

export default async function KotPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ station?: string }>;
}) {
  const { orderId } = await params;
  const { station: stationId } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { rows: orderRows } = await pool.query<{
    id: string;
    order_number: string;
    order_type: "dine_in" | "take_away";
    table_name: string | null;
    notes: string | null;
    created_at: string;
    cashier_name: string;
  }>(
    `SELECT o.id, o.order_number, o.order_type, t.name AS table_name, o.notes, o.created_at,
            u.full_name AS cashier_name
     FROM restaurant_orders o
     LEFT JOIN restaurant_tables t ON t.id = o.table_id
     JOIN users u ON u.id = o.cashier_id
     WHERE o.id = $1`,
    [orderId],
  );
  const order = orderRows[0];
  if (!order) {
    notFound();
  }

  let stationName: string | null = null;
  if (stationId) {
    const { rows: stationRows } = await pool.query<{ name: string }>(
      `SELECT name FROM kitchen_stations WHERE id = $1`,
      [stationId],
    );
    stationName = stationRows[0]?.name ?? null;
  }

  const { rows: items } = await pool.query<{
    product_name: string;
    quantity: string;
    unit_code: string;
    notes: string | null;
  }>(
    stationId
      ? `SELECT ri.product_name, ri.quantity, ri.unit_code, ri.notes
         FROM restaurant_order_items ri
         JOIN products p ON p.id = ri.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE ri.order_id = $1 AND COALESCE(p.station_id, c.station_id) = $2
         ORDER BY ri.created_at`
      : `SELECT ri.product_name, ri.quantity, ri.unit_code, ri.notes
         FROM restaurant_order_items ri
         JOIN products p ON p.id = ri.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE ri.order_id = $1 AND COALESCE(p.station_id, c.station_id) IS NULL
         ORDER BY ri.created_at`,
    stationId ? [orderId, stationId] : [orderId],
  );

  const settings = await getBusinessSettings();

  return (
    <KotView
      businessName={settings.businessName}
      stationName={stationName}
      order={{
        orderNumber: order.order_number,
        orderType: order.order_type,
        tableName: order.table_name,
        createdAt: order.created_at,
        cashierName: order.cashier_name,
      }}
      items={items.map((item) => ({
        productName: item.product_name,
        quantity: Number(item.quantity),
        unitCode: item.unit_code,
        notes: item.notes,
      }))}
    />
  );
}
