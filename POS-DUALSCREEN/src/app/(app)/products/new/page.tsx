import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { getUnits } from "@/lib/units-server";
import { ProductForm } from "../product-form";
import type { CategoryRow } from "../categories-dialog";
import type { SupplierRow } from "../../suppliers/supplier-dialog";

export default async function NewProductPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "products.manage")) {
    redirect("/products");
  }

  const [{ rows: categories }, { rows: suppliers }, units] = await Promise.all([
    pool.query<CategoryRow>(`SELECT id, name FROM categories ORDER BY name`),
    pool.query<SupplierRow>(`SELECT id, name, phone, email, address FROM suppliers ORDER BY name`),
    getUnits(),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-10 py-10">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Add product</h1>
      <ProductForm categories={categories} suppliers={suppliers} units={units} />
    </div>
  );
}
