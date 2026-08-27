"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";

async function requireCustomersManage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "customers.manage")) {
    throw new Error("You do not have permission to manage customers");
  }
  return user;
}

export interface CustomerInput {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isCreditCustomer: boolean;
  creditLimit: number | null;
}

export async function createCustomer(input: CustomerInput): Promise<{ id: string }> {
  await requireCustomersManage();
  if (!input.name.trim()) throw new Error("Customer name is required");

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO customers (name, phone, email, address, is_credit_customer, credit_limit)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [
      input.name.trim(),
      input.phone || null,
      input.email || null,
      input.address || null,
      input.isCreditCustomer,
      input.isCreditCustomer ? input.creditLimit : null,
    ],
  );

  revalidatePath("/customers");
  return rows[0];
}

export async function updateCustomer(customerId: string, input: CustomerInput): Promise<void> {
  await requireCustomersManage();
  if (!input.name.trim()) throw new Error("Customer name is required");

  await pool.query(
    `UPDATE customers SET name=$1, phone=$2, email=$3, address=$4, is_credit_customer=$5, credit_limit=$6, updated_at=now()
     WHERE id=$7`,
    [
      input.name.trim(),
      input.phone || null,
      input.email || null,
      input.address || null,
      input.isCreditCustomer,
      input.isCreditCustomer ? input.creditLimit : null,
      customerId,
    ],
  );

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
}

async function requireCustomersManageCredit() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "customers.manage_credit")) {
    throw new Error("You do not have permission to record credit payments");
  }
  return user;
}

export async function recordCreditPayment(
  customerId: string,
  amount: number,
  method: "cash" | "card",
  notes: string | null,
): Promise<void> {
  const user = await requireCustomersManageCredit();
  if (amount <= 0) throw new Error("Payment amount must be greater than zero");

  await pool.query(
    `INSERT INTO credit_payments (customer_id, amount, payment_method, notes, created_by)
     VALUES ($1,$2,$3,$4,$5)`,
    [customerId, amount, method, notes, user.id],
  );

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers/credit-report");
}
