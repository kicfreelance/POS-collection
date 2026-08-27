import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";
import type { PermissionKey } from "./permissions";

export interface CurrentUser {
  id: string;
  fullName: string;
  username: string;
  roleId: string;
  roleName: string;
  isSuperAdmin: boolean;
  permissions: Set<PermissionKey>;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.role_id, u.is_active,
            r.name AS role_name, r.is_super_admin
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [session.userId],
  );

  const user = rows[0];
  if (!user || !user.is_active) return null;

  let permissions = new Set<PermissionKey>();
  if (!user.is_super_admin) {
    const permRows = await pool.query(
      `SELECT permission_key FROM role_permissions WHERE role_id = $1`,
      [user.role_id],
    );
    permissions = new Set(permRows.rows.map((r: { permission_key: PermissionKey }) => r.permission_key));
  }

  return {
    id: user.id,
    fullName: user.full_name,
    username: user.username,
    roleId: user.role_id,
    roleName: user.role_name,
    isSuperAdmin: user.is_super_admin,
    permissions,
  };
}

export function hasPermission(user: CurrentUser, permission: PermissionKey): boolean {
  return user.isSuperAdmin || user.permissions.has(permission);
}
