"use client";

import { useEffect, useState } from "react";
import { getShortcut } from "./shortcut-registry";
import { ShortcutsSheet } from "./shortcuts-sheet";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function primarySearch(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-primary-search]");
}

/** App-wide keyboard layer: `/` or Ctrl/Cmd+K focuses the page search, `?` opens
 *  the shortcuts sheet, Alt+N runs the page's registered "new" action, and Esc
 *  clears a non-empty primary search. Never calls stopPropagation, so base-ui
 *  dialogs keep owning their own Escape. */
export function ShortcutProvider({ children }: { children: React.ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const typing = isTypingTarget(e.target);

      // Ctrl/Cmd+K works even while typing.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = primarySearch();
        el?.focus();
        if (el instanceof HTMLInputElement) el.select();
        return;
      }

      if (typing) {
        // Esc on a non-empty primary search clears it (and keeps focus).
        if (e.key === "Escape" && e.target instanceof HTMLInputElement) {
          const el = e.target;
          if (el.matches("[data-primary-search]") && el.value) {
            el.value = "";
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        const el = primarySearch();
        el?.focus();
        if (el instanceof HTMLInputElement) el.select();
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
      } else if (e.altKey && e.key.toLowerCase() === "n") {
        const s = getShortcut("page:new");
        if (s) {
          e.preventDefault();
          s.run();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      {children}
      <ShortcutsSheet open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
