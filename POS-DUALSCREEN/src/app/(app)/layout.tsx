import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { NavRail } from "./nav-rail";
import type { ManageLink } from "./manage-menu";

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

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <NavRail
        groups={[
          { label: "Catalog & Stock", links: catalogLinks },
          { label: "Marketing", links: marketingLinks },
          { label: "Operations", links: operationsLinks },
          { label: "Administration", links: adminLinks },
        ]}
        showCheckout={hasPermission(user, "sales.create")}
        showReports={hasPermission(user, "reports.view")}
        showSettings={user.isSuperAdmin}
        roleName={user.roleName}
        user={{ fullName: user.fullName, roleName: user.roleName, hasOpenShift }}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
