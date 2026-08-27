import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { PromotionDialog } from "./promotion-dialog";
import { PromotionsTable, type PromotionRow } from "./promotions-table";

export default async function PromotionsPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "promotions.manage")) {
    redirect("/");
  }

  const [{ rows: promotions }, { rows: products }, { rows: categories }] = await Promise.all([
    pool.query<PromotionRow>(
      `SELECT pr.id, pr.name, pr.type, pr.target_type, pr.is_active, pr.start_at, pr.end_at,
              COALESCE(p.name, c.name, 'Unknown') AS target_name
       FROM promotions pr
       LEFT JOIN products p ON pr.target_type = 'product' AND p.id = pr.target_id
       LEFT JOIN categories c ON pr.target_type = 'category' AND c.id = pr.target_id
       ORDER BY pr.created_at DESC`,
    ),
    pool.query<{ id: string; name: string }>(`SELECT id, name FROM products WHERE is_active = true ORDER BY name`),
    pool.query<{ id: string; name: string }>(`SELECT id, name FROM categories ORDER BY name`),
  ]);

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-8 flex items-center justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Promotions</h1>
          <p className="text-sm text-muted-foreground">
            Surface automatically at checkout when eligible.
          </p>
        </div>
        <PromotionDialog products={products} categories={categories} />
      </div>

      <Card>
        <CardContent>
          <PromotionsTable promotions={promotions} />
        </CardContent>
      </Card>
    </div>
  );
}
