import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { CreateUserDialog } from "./create-user-dialog";
import { UsersTable, type UserRow } from "./users-table";

interface RoleOption {
  id: string;
  name: string;
}

export default async function UsersAdminPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) {
    redirect("/");
  }

  const [{ rows: users }, { rows: roles }] = await Promise.all([
    pool.query<UserRow>(
      `SELECT u.id, u.full_name, u.username, r.name AS role_name, u.is_active
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ORDER BY u.created_at`,
    ),
    pool.query<RoleOption>(`SELECT id, name FROM roles ORDER BY name`),
  ]);

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-8 flex items-center justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Staff Users</h1>
          <p className="text-sm text-muted-foreground">Manage logins, PINs, and access.</p>
        </div>
        <CreateUserDialog roles={roles} />
      </div>

      <Card>
        <CardContent>
          <UsersTable users={users} />
        </CardContent>
      </Card>
    </div>
  );
}
