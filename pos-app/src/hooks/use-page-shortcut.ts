"use client";

import { useEffect, useRef } from "react";
import { registerShortcut, type Shortcut } from "@/components/keyboard/shortcut-registry";

/**
 * Register a page-scoped shortcut for the lifetime of the calling component.
 * `run` is kept in a ref so callers don't need to memoise it.
 */
export function usePageShortcut(opts: {
  id?: string;
  keys: string;
  label: string;
  group?: string;
  run: () => void;
}): void {
  const runRef = useRef(opts.run);
  useEffect(() => {
    runRef.current = opts.run;
  });

  const { id, keys, label, group } = opts;
  useEffect(() => {
    const shortcut: Shortcut = {
      id: id ?? `page:${label}`,
      keys,
      label,
      group: group ?? "This page",
      run: () => runRef.current(),
    };
    return registerShortcut(shortcut);
  }, [id, keys, label, group]);
}

/** Register the page's primary "new / create" action, surfaced as Alt+N. */
export function useRegisterNewAction(run: () => void, label = "New"): void {
  usePageShortcut({ id: "page:new", keys: "Alt+N", label, group: "This page", run });
}

/**
 * One-shot focus of the page's primary search input on mount. Uses a
 * requestAnimationFrame (not a synchronous effect body mutation) so it is safe
 * under the react-hooks lint rules and runs after paint.
 */
export function useAutoFocusPrimary(): void {
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>("[data-primary-search]");
      if (el) {
        el.focus();
        if (el instanceof HTMLInputElement) el.select();
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);
}
