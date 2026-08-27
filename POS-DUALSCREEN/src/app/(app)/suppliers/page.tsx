import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SupplierDialog, type SupplierRow } from "./supplier-dialog";
import { DeleteSupplierButton } from "./delete-supplier-button";

export default async function SuppliersPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "products.view")) {
    redirect("/");
  }
  const canManage = hasPermission(user, "products.manage");

  const { rows: suppliers } = await pool.query<SupplierRow>(
    `SELECT id, name, phone, email, address FROM suppliers ORDER BY name`,
  );

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-8 flex items-center justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">
            Used on goods received notes and product records.
          </p>
        </div>
        {canManage && <SupplierDialog />}
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Address</TableHead>
                {canManage && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell className="text-muted-foreground">{supplier.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{supplier.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{supplier.address ?? "—"}</TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-1">
                        <SupplierDialog supplier={supplier} />
                        <DeleteSupplierButton supplierId={supplier.id} name={supplier.name} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
