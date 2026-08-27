"use client";

import { useSyncExternalStore } from "react";

export interface Shortcut {
  id: string;
  keys: string; // display string, e.g. "Alt+N", "/"
  label: string;
  group: string; // "Global" | "Navigation" | page name
  run: () => void;
}

const shortcuts = new Map<string, Shortcut>();
const listeners = new Set<() => void>();
let snapshot: Shortcut[] = [];

function emit() {
  snapshot = [...shortcuts.values()];
  for (const l of listeners) l();
}

export function registerShortcut(s: Shortcut): () => void {
  shortcuts.set(s.id, s);
  emit();
  return () => {
    if (shortcuts.get(s.id) === s) {
      shortcuts.delete(s.id);
      emit();
    }
  };
}

export function getShortcut(id: string): Shortcut | undefined {
  return shortcuts.get(id);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useShortcuts(): Shortcut[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
