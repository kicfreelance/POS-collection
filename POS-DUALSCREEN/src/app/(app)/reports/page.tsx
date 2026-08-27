import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3,
  TrendingUp,
  Warehouse,
  ArrowLeftRight,
  Tag,
  Users,
  Clock,
  CreditCard,
} from "lucide-react";

const REPORTS = [
  { href: "/reports/sales", title: "Sales", description: "Daily, weekly, or monthly sales totals.", icon: BarChart3 },
  { href: "/reports/profit", title: "Profit & Margin", description: "COGS and margin using the configured costing method.", icon: TrendingUp },
  { href: "/reports/inventory-valuation", title: "Inventory Valuation", description: "Current stock value across all batches.", icon: Warehouse },
  { href: "/reports/stock-movement", title: "Stock Movement", description: "Received, sold, and adjusted quantities.", icon: ArrowLeftRight },
  { href: "/inventory", title: "Low Stock", description: "Products at or below their reorder threshold.", icon: Warehouse },
  { href: "/reports/promotions-coupons", title: "Promotions & Coupons", description: "Usage and discount totals.", icon: Tag },
  { href: "/reports/cashier-performance", title: "Cashier Performance", description: "Sales totals and shift variance by cashier.", icon: Users },
  { href: "/shifts", title: "Shift Summaries", description: "Individual shift reports with cash reconciliation.", icon: Clock },
  { href: "/customers/credit-report", title: "Credit Customer Aging", description: "Outstanding balances by age.", icon: CreditCard },
];

export default async function ReportsHubPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "reports.view")) {
    redirect("/");
  }

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">All reports support date-range filtering and CSV export.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {REPORTS.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <report.icon className="mb-1 size-7 text-primary" />
                <CardTitle className="text-base">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
