import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/rbac";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      roleName: user.roleName,
      isSuperAdmin: user.isSuperAdmin,
      permissions: Array.from(user.permissions),
    },
  });
}
