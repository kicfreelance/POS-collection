import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import { verifyPin } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth/session";

interface LoginRow {
  id: string;
  pin_hash: string;
  is_active: boolean;
  role_id: string;
  role_name: string;
  is_super_admin: boolean;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const pin = typeof body?.pin === "string" ? body.pin : "";

  if (!username || !pin) {
    return NextResponse.json({ error: "Username and PIN are required" }, { status: 400 });
  }

  const { rows } = await pool.query<LoginRow>(
    `SELECT u.id, u.pin_hash, u.is_active, u.role_id, r.name AS role_name, r.is_super_admin
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE lower(u.username) = $1`,
    [username],
  );

  const user = rows[0];
  if (!user || !user.is_active) {
    return NextResponse.json({ error: "Invalid username or PIN" }, { status: 401 });
  }

  const valid = await verifyPin(pin, user.pin_hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid username or PIN" }, { status: 401 });
  }

  const token = await createSessionToken({
    userId: user.id,
    roleId: user.role_id,
    roleName: user.role_name,
    isSuperAdmin: user.is_super_admin,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
