"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  LayoutGrid,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ManageLink } from "./manage-menu";
import { UserMenu } from "./user-menu";

interface NavRailProps {
  groups: { label: string; links: ManageLink[] }[];
  showCheckout: boolean;
  showReports: boolean;
  showSettings: boolean;
  roleName: string;
  user: { fullName: string; roleName: string; hasOpenShift: boolean };
}

function useActive(href: string): boolean {
  const pathname = usePathname();
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function RailLink({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  const active = useActive(href);
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-12 items-center justify-center rounded-2xl transition-colors",
        active
          ? "bg-accent text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-6" />
    </Link>
  );
}

export function NavRail({
  groups,
  showCheckout,
  showReports,
  showSettings,
  roleName,
  user,
}: NavRailProps) {
  const pathname = usePathname();
  const visibleGroups = groups.filter((g) => g.links.length > 0);

  return (
    <aside className="sticky top-0 z-30 flex h-screen w-20 shrink-0 flex-col items-center gap-1.5 border-r border-border/70 bg-card py-4 print:hidden">
      <Link
        href="/"
        aria-label="Home"
        className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-sm shadow-primary/30"
      >
        P
      </Link>

      <RailLink href="/" label="Dashboard" icon={LayoutDashboard} />

      {visibleGroups.length > 0 && (
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label="Manage"
                title="Manage"
                className="flex size-12 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-expanded:bg-accent aria-expanded:text-primary"
              />
            }
          >
            <LayoutGrid className="size-6" />
          </PopoverTrigger>
          <PopoverContent side="right" align="start" sideOffset={10} className="w-60 p-2">
            <nav className="grid gap-2">
              {visibleGroups.map((group) => (
                <div key={group.label} className="grid gap-0.5">
                  <p className="px-2 pt-1 pb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  {group.links.map((link) => {
                    const active =
                      pathname === link.href || pathname.startsWith(`${link.href}/`);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground/80 hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </PopoverContent>
        </Popover>
      )}

      {showCheckout && <RailLink href="/checkout" label="Point of sale" icon={ShoppingCart} />}
      {showReports && <RailLink href="/reports" label="Reports" icon={BarChart3} />}

      <div className="flex-1" />

      <span className="max-w-16 truncate text-center text-[0.65rem] font-medium text-muted-foreground">
        {roleName}
      </span>
      {showSettings && <RailLink href="/admin/settings" label="Settings" icon={Settings} />}
      <UserMenu {...user} compact />
    </aside>
  );
}
