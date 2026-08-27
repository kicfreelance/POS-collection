"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/rbac";
import { isPermissionKey } from "@/lib/auth/permissions";

async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || !user.isSuperAdmin) {
    throw new Error("Only Super Admin can manage roles");
  }
  return user;
}

export async function createRole(name: string): Promise<void> {
  await requireSuperAdmin();

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Role name is required");
  }

  await pool.query(
    `INSERT INTO roles (name, is_super_admin, is_system) VALUES ($1, false, false)`,
    [trimmed],
  );

  revalidatePath("/admin/roles");
}

export async function deleteRole(roleId: string): Promise<void> {
  await requireSuperAdmin();

  const { rows } = await pool.query<{ is_system: boolean }>(
    `SELECT is_system FROM roles WHERE id = $1`,
    [roleId],
  );

  if (!rows[0] || rows[0].is_system) {
    throw new Error("This role cannot be deleted");
  }

  const { rows: usersOnRole } = await pool.query(
    `SELECT id FROM users WHERE role_id = $1 LIMIT 1`,
    [roleId],
  );
  if (usersOnRole.length > 0) {
    throw new Error("Reassign staff off this role before deleting it");
  }

  await pool.query(`DELETE FROM roles WHERE id = $1`, [roleId]);

  revalidatePath("/admin/roles");
}

export async function setRolePermission(
  roleId: string,
  permissionKey: string,
  enabled: boolean,
): Promise<void> {
  await requireSuperAdmin();

  if (!isPermissionKey(permissionKey)) {
    throw new Error("Unknown permission");
  }

  if (enabled) {
    await pool.query(
      `INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [roleId, permissionKey],
    );
  } else {
    await pool.query(
      `DELETE FROM role_permissions WHERE role_id = $1 AND permission_key = $2`,
      [roleId, permissionKey],
    );
  }

  revalidatePath("/admin/roles");
}
