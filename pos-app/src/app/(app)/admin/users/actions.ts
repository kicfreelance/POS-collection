"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/rbac";
import { hashPin } from "@/lib/auth/password";

async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || !user.isSuperAdmin) {
    throw new Error("Only Super Admin can manage users");
  }
  return user;
}

export async function createUser(input: {
  fullName: string;
  username: string;
  roleId: string;
  pin: string;
}): Promise<void> {
  await requireSuperAdmin();

  const fullName = input.fullName.trim();
  const username = input.username.trim().toLowerCase();

  if (!fullName || !username || !input.roleId || !/^\d{4,8}$/.test(input.pin)) {
    throw new Error("Full name, username, role, and a 4-8 digit PIN are required");
  }

  const pinHash = await hashPin(input.pin);

  await pool.query(
    `INSERT INTO users (full_name, username, pin_hash, role_id) VALUES ($1, $2, $3, $4)`,
    [fullName, username, pinHash, input.roleId],
  );

  revalidatePath("/admin/users");
}

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  await requireSuperAdmin();

  await pool.query(`UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2`, [
    isActive,
    userId,
  ]);

  revalidatePath("/admin/users");
}

export async function resetUserPin(userId: string, pin: string): Promise<void> {
  await requireSuperAdmin();

  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error("A 4-8 digit PIN is required");
  }

  const pinHash = await hashPin(pin);

  await pool.query(`UPDATE users SET pin_hash = $1, updated_at = now() WHERE id = $2`, [
    pinHash,
    userId,
  ]);

  revalidatePath("/admin/users");
}
