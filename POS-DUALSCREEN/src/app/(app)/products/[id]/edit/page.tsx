import { notFound, redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { getUnits } from "@/lib/units-server";
import { ProductForm, type ProductRecord } from "../../product-form";
import type { CategoryRow } from "../../categories-dialog";
import type { SupplierRow } from "../../../suppliers/supplier-dialog";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "products.manage")) {
    redirect("/products");
  }

  const [{ rows: productRows }, { rows: categories }, { rows: suppliers }, units] = await Promise.all([
    pool.query<ProductRecord>(
      `SELECT id, name, sku, barcode, category_id, supplier_id, base_unit,
              cost_price, selling_price, tax_rate, discount_type, discount_value, reorder_threshold, image_data_url
       FROM products WHERE id = $1`,
      [id],
    ),
    pool.query<CategoryRow>(`SELECT id, name FROM categories ORDER BY name`),
    pool.query<SupplierRow>(`SELECT id, name, phone, email, address FROM suppliers ORDER BY name`),
    getUnits(),
  ]);

  const product = productRows[0];
  if (!product) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-10 py-10">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Edit product</h1>
      <ProductForm product={product} categories={categories} suppliers={suppliers} units={units} />
    </div>
  );
}
