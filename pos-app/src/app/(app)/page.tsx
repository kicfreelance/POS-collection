import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ShoppingCart,
  Package,
  Truck,
  Warehouse,
  ClipboardList,
  Tag,
  Ticket,
  Users,
  Clock,
  BarChart3,
  UserCog,
  Shield,
  Settings,
  UtensilsCrossed,
  Table2,
  Wallet,
  AlertTriangle,
  Receipt,
} from "lucide-react";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission, type CurrentUser } from "@/lib/auth/rbac";
import { getBusinessSettings } from "@/lib/settings-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SalesTrendChart, CategoryPieChart, TopProductsChart } from "./dashboard-charts";

export const dynamic = "force-dynamic";

interface ShortcutDef {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: (user: CurrentUser) => boolean;
  primary?: boolean;
}

const SHORTCUTS: ShortcutDef[] = [
  {
    href: "/checkout",
    title: "Open POS",
    description: "Start a new sale or order.",
    icon: ShoppingCart,
    visible: (u) => hasPermission(u, "sales.create"),
    primary: true,
  },
  {
    href: "/products",
    title: "Products",
    description: "Catalog, units, and barcodes.",
    icon: Package,
    visible: (u) => hasPermission(u, "products.view"),
  },
  {
    href: "/suppliers",
    title: "Suppliers",
    description: "Manage supplier records.",
    icon: Truck,
    visible: (u) => hasPermission(u, "products.view"),
  },
  {
    href: "/inventory",
    title: "Inventory",
    description: "Stock levels and batches.",
    icon: Warehouse,
    visible: (u) => hasPermission(u, "inventory.view"),
  },
  {
    href: "/grn",
    title: "GRN",
    description: "Goods received notes.",
    icon: ClipboardList,
    visible: (u) => hasPermission(u, "grn.manage"),
  },
  {
    href: "/promotions",
    title: "Promotions",
    description: "Discounts and offers.",
    icon: Tag,
    visible: (u) => hasPermission(u, "promotions.manage"),
  },
  {
    href: "/coupons",
    title: "Coupons",
    description: "Vouchers and codes.",
    icon: Ticket,
    visible: (u) => hasPermission(u, "coupons.manage"),
  },
  {
    href: "/customers",
    title: "Customers",
    description: "Customer records and credit.",
    icon: Users,
    visible: (u) => hasPermission(u, "customers.view"),
  },
  {
    href: "/shifts",
    title: "Shifts",
    description: "Open/close shifts and history.",
    icon: Clock,
    visible: (u) => hasPermission(u, "shifts.open_close") || hasPermission(u, "reports.view"),
  },
  {
    href: "/reports",
    title: "Reports",
    description: "Sales, profit, and stock reports.",
    icon: BarChart3,
    visible: (u) => hasPermission(u, "reports.view"),
  },
  {
    href: "/admin/users",
    title: "Users",
    description: "Staff accounts and PINs.",
    icon: UserCog,
    visible: (u) => u.isSuperAdmin,
  },
  {
    href: "/admin/roles",
    title: "Roles",
    description: "Permissions by role.",
    icon: Shield,
    visible: (u) => u.isSuperAdmin,
  },
  {
    href: "/admin/settings",
    title: "Settings",
    description: "Business, tax, and printers.",
    icon: Settings,
    visible: (u) => u.isSuperAdmin,
  },
];

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const settings = await getBusinessSettings();
  const isRestaurant = settings.businessType === "restaurant";

  const [{ rows: salesRows }, { rows: shiftRows }] = await Promise.all([
    pool.query<{ count: string; total: string }>(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(total), 0) AS total
       FROM sales WHERE status = 'completed' AND created_at::date = CURRENT_DATE`,
    ),
    pool.query<{ opening_cash: string; opened_at: string }>(
      `SELECT opening_cash, opened_at FROM shifts WHERE cashier_id = $1 AND status = 'open'`,
      [user.id],
    ),
  ]);

  const todaySales = { count: Number(salesRows[0].count), total: Number(salesRows[0].total) };
  const openShift = shiftRows[0] ?? null;

  let lowStockCount: number | null = null;
  if (hasPermission(user, "inventory.view")) {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM (
         SELECT p.id
         FROM products p
         LEFT JOIN batches b ON b.product_id = p.id
         WHERE p.is_active = true AND p.reorder_threshold > 0
         GROUP BY p.id, p.reorder_threshold
         HAVING COALESCE(SUM(b.quantity_remaining), 0) <= p.reorder_threshold
       ) low_stock`,
    );
    lowStockCount = Number(rows[0].count);
  }

  let restaurantStats: { openOrders: number; occupiedTables: number } | null = null;
  if (isRestaurant && hasPermission(user, "sales.create")) {
    const [{ rows: orderRows }, { rows: tableRows }] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM restaurant_orders WHERE status IN ('open', 'served')`,
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM restaurant_tables t
         WHERE t.is_active = true AND EXISTS (
           SELECT 1 FROM restaurant_orders o WHERE o.table_id = t.id AND o.status IN ('open', 'served')
         )`,
      ),
    ]);
    restaurantStats = { openOrders: Number(orderRows[0].count), occupiedTables: Number(tableRows[0].count) };
  }

  let charts: {
    trend: { date: string; label: string; total: number }[];
    categories: { category: string; total: number }[];
    topProducts: { name: string; total: number }[];
  } | null = null;

  if (hasPermission(user, "reports.view")) {
    const [{ rows: trendRows }, { rows: categoryRows }, { rows: productRows }] = await Promise.all([
      pool.query<{ day: Date; total: string }>(
        `SELECT created_at::date AS day, COALESCE(SUM(total), 0) AS total
         FROM sales
         WHERE status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '13 days'
         GROUP BY created_at::date
         ORDER BY day`,
      ),
      pool.query<{ category: string; total: string }>(
        `SELECT COALESCE(c.name, 'Uncategorized') AS category, SUM(si.line_total) AS total
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN products p ON p.id = si.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE s.status = 'completed' AND s.created_at >= CURRENT_DATE - INTERVAL '29 days'
         GROUP BY category
         ORDER BY total DESC
         LIMIT 6`,
      ),
      pool.query<{ name: string; total: string }>(
        `SELECT si.product_name AS name, SUM(si.line_total) AS total
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE s.status = 'completed' AND s.created_at >= CURRENT_DATE - INTERVAL '29 days'
         GROUP BY si.product_name
         ORDER BY total DESC
         LIMIT 5`,
      ),
    ]);

    const totalsByDay = new Map(
      trendRows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.total)]),
    );
    const trend: { date: string; label: string; total: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      trend.push({
        date: iso,
        label: d.toLocaleDateString(settings.locale, { month: "short", day: "numeric" }),
        total: totalsByDay.get(iso) ?? 0,
      });
    }

    charts = {
      trend,
      categories: categoryRows.map((r) => ({ category: r.category, total: Number(r.total) })),
      topProducts: productRows.map((r) => ({ name: r.name, total: Number(r.total) })).reverse(),
    };
  }

  const shortcuts = SHORTCUTS.filter((s) => s.visible(user));
  const primaryShortcut = shortcuts.find((s) => s.primary);
  const otherShortcuts = shortcuts.filter((s) => !s.primary);

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {user.fullName} · {settings.businessName}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Receipt className="size-5Receipttext-blue-500 dark:text-blue-400" /> Today&apos;s Sales
            </CardDescription>
            <CardTitle className="text-2xl">
              {settings.currencySymbol}
              {todaySales.total.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {todaySales.count} transaction{todaySales.count === 1 ? "" : "s"}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Wallet className="size-5Wallettext-emerald-500 dark:text-emerald-400" /> Shift Status
            </CardDescription>
            <CardTitle className="text-2xl">{openShift ? "Open" : "Not started"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {openShift
              ? `Opened ${new Date(openShift.opened_at).toLocaleTimeString()} · drawer ${settings.currencySymbol}${Number(openShift.opening_cash).toFixed(2)}`
              : "Start a shift from the POS screen"}
          </CardContent>
        </Card>

        {lowStockCount !== null && (
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <AlertTriangle className="size-5AlertTriangletext-amber-500 dark:text-amber-400" /> Low Stock
              </CardDescription>
              <CardTitle className="text-2xl">{lowStockCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {lowStockCount === 0 ? "Everything is above reorder level" : "Products at or below reorder threshold"}
            </CardContent>
          </Card>
        )}

        {restaurantStats && (
          <>
            <Card className="border-l-4 border-l-violet-500">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <UtensilsCrossed className="size-5UtensilsCrossedtext-violet-500 dark:text-violet-400" /> Open Orders
                </CardDescription>
                <CardTitle className="text-2xl">{restaurantStats.openOrders}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Preparing or awaiting payment</CardContent>
            </Card>
            <Card className="border-l-4 border-l-cyan-500">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Table2 className="size-5Table2text-cyan-500 dark:text-cyan-400" /> Occupied Tables
                </CardDescription>
                <CardTitle className="text-2xl">{restaurantStats.occupiedTables}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Currently have an open order</CardContent>
            </Card>
          </>
        )}
      </div>

      {charts && (
        <div className="mb-8 grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Sales Trend</CardTitle>
              <CardDescription>Last 14 days</CardDescription>
            </CardHeader>
            <CardContent>
              <SalesTrendChart data={charts.trend} currencySymbol={settings.currencySymbol} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sales by Category</CardTitle>
              <CardDescription>Last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {charts.categories.length > 0 ? (
                <CategoryPieChart data={charts.categories} currencySymbol={settings.currencySymbol} />
              ) : (
                <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  No sales yet in this period.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Top Products</CardTitle>
              <CardDescription>By revenue, last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {charts.topProducts.length > 0 ? (
                <TopProductsChart data={charts.topProducts} currencySymbol={settings.currencySymbol} />
              ) : (
                <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  No sales yet in this period.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {primaryShortcut && (
        <Link href={primaryShortcut.href} className="mb-6 block">
          <Card className="border-primary/40 bg-primary/5 transition-colors hover:border-primary">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <primaryShortcut.icon className="size-8" />
              </div>
              <div>
                <p className="text-lg font-semibold">{primaryShortcut.title}</p>
                <p className="text-sm text-muted-foreground">{primaryShortcut.description}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {otherShortcuts.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {otherShortcuts.map((shortcut) => (
            <Link key={shortcut.href} href={shortcut.href}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader>
                  <shortcut.icon className="mb-1 size-7 text-primary" />
                  <CardTitle className="text-base">{shortcut.title}</CardTitle>
                  <CardDescription>{shortcut.description}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
