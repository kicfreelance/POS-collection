import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyPin } from "@/lib/auth/password";
import { isPermissionKey } from "@/lib/auth/permissions";
import { createApprovalToken } from "@/lib/auth/session";

interface SupervisorRow {
  id: string;
  full_name: string;
  pin_hash: string;
  is_active: boolean;
  role_id: string;
  is_super_admin: boolean;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const pin = typeof body?.pin === "string" ? body.pin : "";
  const permission = typeof body?.permission === "string" ? body.permission : "";

  if (!username || !pin || !isPermissionKey(permission)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { rows } = await pool.query<SupervisorRow>(
    `SELECT u.id, u.full_name, u.pin_hash, u.is_active, u.role_id, r.is_super_admin
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE lower(u.username) = $1`,
    [username],
  );

  const approver = rows[0];
  if (!approver || !approver.is_active || !(await verifyPin(pin, approver.pin_hash))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  let authorized = approver.is_super_admin;
  if (!authorized) {
    const { rows: permRows } = await pool.query(
      `SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_key = $2`,
      [approver.role_id, permission],
    );
    authorized = permRows.length > 0;
  }

  if (!authorized) {
    return NextResponse.json(
      { error: "This user does not have permission to approve that action" },
      { status: 403 },
    );
  }

  const approvalToken = await createApprovalToken({
    approverId: approver.id,
    approverName: approver.full_name,
    permission,
  });

  return NextResponse.json({ ok: true, approverName: approver.full_name, approvalToken });
}
