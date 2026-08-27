"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

export interface ManageLink {
  href: string;
  label: string;
}

export function ManageMenu({ groups }: { groups: { label: string; links: ManageLink[] }[] }) {
  const pathname = usePathname();
  const visibleGroups = groups.filter((g) => g.links.length > 0);
  if (visibleGroups.length === 0) return null;

  return (
    <nav className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
      {visibleGroups.map((group, index) => (
        <div key={group.label} className="flex flex-wrap items-center gap-1">
          {index > 0 && <Separator orientation="vertical" className="mx-1.5 h-4" />}
          {group.links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
