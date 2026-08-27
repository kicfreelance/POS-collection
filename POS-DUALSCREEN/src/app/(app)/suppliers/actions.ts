"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";

async function requireProductsManage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "products.manage")) {
    throw new Error("You do not have permission to manage suppliers");
  }
  return user;
}

export interface SupplierInput {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export async function createSupplier(input: SupplierInput): Promise<void> {
  await requireProductsManage();
  if (!input.name.trim()) throw new Error("Supplier name is required");

  await pool.query(
    `INSERT INTO suppliers (name, phone, email, address) VALUES ($1, $2, $3, $4)`,
    [input.name.trim(), input.phone || null, input.email || null, input.address || null],
  );

  revalidatePath("/suppliers");
}

export async function updateSupplier(supplierId: string, input: SupplierInput): Promise<void> {
  await requireProductsManage();
  if (!input.name.trim()) throw new Error("Supplier name is required");

  await pool.query(
    `UPDATE suppliers SET name=$1, phone=$2, email=$3, address=$4, updated_at=now() WHERE id=$5`,
    [input.name.trim(), input.phone || null, input.email || null, input.address || null, supplierId],
  );

  revalidatePath("/suppliers");
}

export async function deleteSupplier(supplierId: string): Promise<void> {
  await requireProductsManage();

  const { rows } = await pool.query("SELECT id FROM products WHERE supplier_id = $1 LIMIT 1", [
    supplierId,
  ]);
  if (rows.length > 0) {
    throw new Error("Reassign products off this supplier before deleting it");
  }

  await pool.query(`DELETE FROM suppliers WHERE id = $1`, [supplierId]);
  revalidatePath("/suppliers");
}
