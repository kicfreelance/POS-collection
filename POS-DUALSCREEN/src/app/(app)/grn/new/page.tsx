import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { GrnForm } from "../grn-form";
import type { SupplierRow } from "../../suppliers/supplier-dialog";

export default async function NewGrnPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "grn.manage")) {
    redirect("/grn");
  }

  const [{ rows: suppliers }, { rows: products }] = await Promise.all([
    pool.query<SupplierRow>(`SELECT id, name, phone, email, address FROM suppliers ORDER BY name`),
    pool.query<{ id: string; name: string; sku: string; base_unit: string; cost_price: string }>(
      `SELECT id, name, sku, base_unit, cost_price FROM products WHERE is_active = true ORDER BY name`,
    ),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-10 py-10">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">New GRN</h1>
      <GrnForm suppliers={suppliers} products={products} />
    </div>
  );
}
