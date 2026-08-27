import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { setRolePermission } from "./actions";
import { CreateRoleDialog } from "./create-role-dialog";
import { DeleteRoleButton } from "./delete-role-button";
import { PermissionToggle } from "./permission-toggle";

interface RoleRow {
  id: string;
  name: string;
  is_super_admin: boolean;
  is_system: boolean;
}

interface RolePermissionRow {
  role_id: string;
  permission_key: string;
}

export default async function RolesAdminPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) {
    redirect("/");
  }

  const [{ rows: roles }, { rows: rolePermissionRows }] = await Promise.all([
    pool.query<RoleRow>(
      `SELECT id, name, is_super_admin, is_system FROM roles ORDER BY is_super_admin DESC, name`,
    ),
    pool.query<RolePermissionRow>(`SELECT role_id, permission_key FROM role_permissions`),
  ]);

  const permissionsByRole = new Map<string, Set<string>>();
  for (const row of rolePermissionRows) {
    if (!permissionsByRole.has(row.role_id)) {
      permissionsByRole.set(row.role_id, new Set());
    }
    permissionsByRole.get(row.role_id)?.add(row.permission_key);
  }

  const modules = Array.from(new Set(PERMISSIONS.map((p) => p.module)));

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Roles &amp; Permissions</h1>
        <CreateRoleDialog />
      </div>

      <div className="grid gap-5">
        {roles.map((role) => {
          const rolePerms = permissionsByRole.get(role.id) ?? new Set<string>();
          return (
            <Card key={role.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  {role.name}
                  {role.is_super_admin && (
                    <Badge variant="secondary">full access</Badge>
                  )}
                </CardTitle>
                {!role.is_system && <DeleteRoleButton roleId={role.id} roleName={role.name} />}
              </CardHeader>
              <CardContent>
                {role.is_super_admin ? (
                  <p className="text-sm text-muted-foreground">
                    Super Admin always has every permission and cannot be edited.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {modules.map((moduleName) => (
                      <div key={moduleName}>
                        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {moduleName}
                        </h3>
                        <div className="flex flex-col gap-2.5">
                          {PERMISSIONS.filter((p) => p.module === moduleName).map((permission) => {
                            const enabled = rolePerms.has(permission.key);
                            return (
                              <PermissionToggle
                                key={`${role.id}-${permission.key}-${enabled}`}
                                id={`${role.id}-${permission.key}`}
                                action={setRolePermission.bind(
                                  null,
                                  role.id,
                                  permission.key,
                                  !enabled,
                                )}
                                defaultChecked={enabled}
                                label={permission.description}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
