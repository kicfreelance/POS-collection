"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";

async function requireProductsManage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "products.manage")) {
    throw new Error("You do not have permission to manage products");
  }
  return user;
}

function ean13CheckDigit(digits12: string): number {
  const sum = digits12
    .split("")
    .map(Number)
    .reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

export async function generateBarcode(): Promise<string> {
  await requireProductsManage();
  const prefix = "20";
  const middle = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
  const digits12 = prefix + middle;
  return digits12 + ean13CheckDigit(digits12);
}

export interface ProductInput {
  name: string;
  sku: string;
  barcode: string | null;
  categoryId: string | null;
  supplierId: string | null;
  baseUnit: string;
  costPrice: number;
  sellingPrice: number;
  taxRate: number;
  discountType: "percentage" | "flat" | null;
  discountValue: number | null;
  reorderThreshold: number;
  imageDataUrl: string | null;
}

function validateProductInput(input: ProductInput) {
  if (!input.name.trim()) throw new Error("Product name is required");
  if (!input.sku.trim()) throw new Error("SKU is required");
  if (!input.baseUnit) throw new Error("Base unit is required");
  if (input.costPrice < 0 || input.sellingPrice < 0) throw new Error("Prices cannot be negative");
  if (input.taxRate < 0 || input.taxRate > 100) throw new Error("Tax rate must be between 0 and 100");
  if (input.discountType === "percentage" && (input.discountValue ?? 0) > 100) {
    throw new Error("Percentage discount cannot exceed 100");
  }
}

export async function createProduct(input: ProductInput): Promise<{ id: string }> {
  await requireProductsManage();
  validateProductInput(input);

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO products
      (name, sku, barcode, category_id, supplier_id, base_unit, cost_price, selling_price, tax_rate, discount_type, discount_value, reorder_threshold, image_data_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [
      input.name.trim(),
      input.sku.trim(),
      input.barcode || null,
      input.categoryId,
      input.supplierId,
      input.baseUnit,
      input.costPrice,
      input.sellingPrice,
      input.taxRate,
      input.discountType,
      input.discountValue,
      input.reorderThreshold,
      input.imageDataUrl,
    ],
  );

  revalidatePath("/products");
  return rows[0];
}

export async function updateProduct(productId: string, input: ProductInput): Promise<void> {
  await requireProductsManage();
  validateProductInput(input);

  await pool.query(
    `UPDATE products SET
      name=$1, sku=$2, barcode=$3, category_id=$4, supplier_id=$5, base_unit=$6,
      cost_price=$7, selling_price=$8, tax_rate=$9, discount_type=$10, discount_value=$11,
      reorder_threshold=$12, image_data_url=$13, updated_at=now()
     WHERE id=$14`,
    [
      input.name.trim(),
      input.sku.trim(),
      input.barcode || null,
      input.categoryId,
      input.supplierId,
      input.baseUnit,
      input.costPrice,
      input.sellingPrice,
      input.taxRate,
      input.discountType,
      input.discountValue,
      input.reorderThreshold,
      input.imageDataUrl,
      productId,
    ],
  );

  revalidatePath("/products");
}

export async function setProductActive(productId: string, isActive: boolean): Promise<void> {
  await requireProductsManage();
  await pool.query(`UPDATE products SET is_active=$1, updated_at=now() WHERE id=$2`, [
    isActive,
    productId,
  ]);
  revalidatePath("/products");
}

export async function createCategory(name: string): Promise<void> {
  await requireProductsManage();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required");
  await pool.query(`INSERT INTO categories (name) VALUES ($1)`, [trimmed]);
  revalidatePath("/products");
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await requireProductsManage();
  await pool.query(`UPDATE products SET category_id = NULL WHERE category_id = $1`, [categoryId]);
  await pool.query(`DELETE FROM categories WHERE id = $1`, [categoryId]);
  revalidatePath("/products");
}
