import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductsTable, type ProductListRow } from "./products-table";
import { CategoriesDialog, type CategoryRow } from "./categories-dialog";

export default async function ProductsPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "products.view")) {
    redirect("/");
  }
  const canManage = hasPermission(user, "products.manage");

  const [{ rows: products }, { rows: categories }] = await Promise.all([
    pool.query<ProductListRow>(
      `SELECT p.id, p.name, p.sku, p.barcode, c.name AS category_name, p.base_unit, p.selling_price, p.is_active
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.created_at DESC`,
    ),
    pool.query<CategoryRow>(`SELECT id, name FROM categories ORDER BY name`),
  ]);

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-8 flex items-center justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Catalog, units, and barcodes.</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <CategoriesDialog categories={categories} />
            <Button render={<Link href="/products/new" />}>
              <Plus />
              Add Product
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent>
          <ProductsTable products={products} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  );
}
