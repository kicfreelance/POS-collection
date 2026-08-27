"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useShortcuts } from "./shortcut-registry";

const BUILT_IN: { group: string; items: { keys: string; label: string }[] }[] = [
  {
    group: "Global",
    items: [
      { keys: "/  ·  Ctrl+K", label: "Focus the search box" },
      { keys: "?", label: "Show / hide this list" },
      { keys: "Alt+N", label: "New (where the page has a create action)" },
      { keys: "Esc", label: "Clear the search box / close a dialog" },
    ],
  },
  {
    group: "Lists & grids",
    items: [
      { keys: "↑ ↓ ← →", label: "Move between rows / tiles" },
      { keys: "Home · End", label: "Jump to first / last" },
      { keys: "Enter · Space", label: "Open / activate the highlighted row" },
      { keys: "type letters", label: "Jump to a matching row" },
    ],
  },
];

export function ShortcutsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const registered = useShortcuts();
  const grouped = useMemo(() => {
    const m = new Map<string, { keys: string; label: string }[]>();
    for (const s of registered) {
      const list = m.get(s.group) ?? [];
      list.push({ keys: s.keys, label: s.label });
      m.set(s.group, list);
    }
    return [...m.entries()];
  }, [registered]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Everything in the POS can be driven from the keyboard.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {[...BUILT_IN, ...grouped.map(([group, items]) => ({ group, items }))].map((section) => (
            <div key={section.group}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.group}
              </p>
              <ul className="grid gap-1 text-sm">
                {section.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{it.label}</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {it.keys}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
