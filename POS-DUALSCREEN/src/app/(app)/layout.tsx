import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserMenu } from "./user-menu";
import { ManageMenu, type ManageLink } from "./manage-menu";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { rows: openShiftRows } = await pool.query(
    `SELECT id FROM shifts WHERE cashier_id = $1 AND status = 'open'`,
    [user.id],
  );
  const hasOpenShift = openShiftRows.length > 0;

  const catalogLinks: ManageLink[] = [];
  if (hasPermission(user, "products.view")) {
    catalogLinks.push({ href: "/products", label: "Products" }, { href: "/suppliers", label: "Suppliers" });
  }
  if (hasPermission(user, "inventory.view")) {
    catalogLinks.push({ href: "/inventory", label: "Inventory" });
  }
  if (hasPermission(user, "grn.manage")) {
    catalogLinks.push({ href: "/grn", label: "GRN" });
  }

  const marketingLinks: ManageLink[] = [];
  if (hasPermission(user, "promotions.manage")) {
    marketingLinks.push({ href: "/promotions", label: "Promotions" });
  }
  if (hasPermission(user, "coupons.manage")) {
    marketingLinks.push({ href: "/coupons", label: "Coupons" });
  }
  if (hasPermission(user, "customers.view")) {
    marketingLinks.push({ href: "/customers", label: "Customers" });
  }

  const operationsLinks: ManageLink[] = [];
  if (hasPermission(user, "shifts.open_close") || hasPermission(user, "reports.view")) {
    operationsLinks.push({ href: "/shifts", label: "Shifts" });
  }
  if (hasPermission(user, "reports.view")) {
    operationsLinks.push({ href: "/reports", label: "Reports" });
  }

  const adminLinks: ManageLink[] = [];
  if (user.isSuperAdmin) {
    adminLinks.push(
      { href: "/admin/users", label: "Users" },
      { href: "/admin/roles", label: "Roles" },
      { href: "/admin/settings", label: "Settings" },
    );
  }

  const hasAnyNavLinks =
    catalogLinks.length > 0 || marketingLinks.length > 0 || operationsLinks.length > 0 || adminLinks.length > 0;

  return (
    <div
      className="relative flex min-h-screen flex-col text-foreground"
      style={{
        background:
          "radial-gradient(75% 55% at 50% 0%, color-mix(in oklch, var(--primary), transparent 85%), transparent), var(--background)",
      }}
    >
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border/60 bg-background/70 px-8 py-3 backdrop-blur-md print:hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <Link href="/" className="mr-1 shrink-0 text-base font-semibold tracking-tight">
            POS
          </Link>
          {hasAnyNavLinks && (
            <ManageMenu
              groups={[
                { label: "Catalog & Stock", links: catalogLinks },
                { label: "Marketing", links: marketingLinks },
                { label: "Operations", links: operationsLinks },
                { label: "Administration", links: adminLinks },
              ]}
            />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {hasPermission(user, "sales.create") && (
            <Button size="sm" render={<Link href="/checkout" />}>
              <ShoppingCart /> Open POS
            </Button>
          )}
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {user.roleName}
          </Badge>
          <UserMenu fullName={user.fullName} roleName={user.roleName} hasOpenShift={hasOpenShift} />
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
