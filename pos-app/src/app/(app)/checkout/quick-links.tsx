"use client";

import Link from "next/link";
import { LayoutDashboard, Package, Warehouse, Users, Clock, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface QuickLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface QuickLinkFlags {
  products: boolean;
  inventory: boolean;
  customers: boolean;
  shifts: boolean;
  reports: boolean;
}

export function buildQuickLinks(flags: QuickLinkFlags): QuickLink[] {
  const links: QuickLink[] = [{ href: "/", label: "Dashboard", icon: LayoutDashboard }];
  if (flags.products) links.push({ href: "/products", label: "Products", icon: Package });
  if (flags.inventory) links.push({ href: "/inventory", label: "Inventory", icon: Warehouse });
  if (flags.customers) links.push({ href: "/customers", label: "Customers", icon: Users });
  if (flags.shifts) links.push({ href: "/shifts", label: "Shifts", icon: Clock });
  if (flags.reports) links.push({ href: "/reports", label: "Reports", icon: BarChart3 });
  return links;
}

export function QuickLinksMenu({ links }: { links: QuickLink[] }) {
  if (links.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {links.map((link) => (
        <Button key={link.href} variant="outline" size="icon" title={link.label} render={<Link href={link.href} />}>
          <link.icon />
        </Button>
      ))}
    </div>
  );
}
