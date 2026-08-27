"use client";

import { useCallback, useState, type KeyboardEvent } from "react";

export interface UseListNavigationOptions {
  itemCount: number;
  /** >1 => 2-D grid (Left/Right = ±1, Up/Down = ±columns). Omitted/1 => vertical list. */
  columns?: number;
  loop?: boolean;
  initialIndex?: number;
  onActivate?: (index: number) => void;
  /** Return a label for each row to enable type-ahead jump. */
  getTypeaheadLabel?: (index: number) => string;
  disabled?: boolean;
}

export interface ListItemProps {
  tabIndex: 0 | -1;
  "data-active": "" | undefined;
  "data-nav-item": number;
  onFocus: () => void;
  onClick: () => void;
}

export interface UseListNavigationResult {
  activeIndex: number;
  containerProps: {
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  };
  getItemProps: (index: number) => ListItemProps;
}

function isFromField(e: KeyboardEvent<HTMLElement>): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

// Module-scoped type-ahead buffer — no state, no ref.
let taBuf = "";
let taAt = 0;

/**
 * Roving-tabindex keyboard navigation for a list or 2-D grid. Ref-free: the
 * keydown handler locates items via `[data-nav-item]` under `e.currentTarget`,
 * so there is no synchronous setState in an effect and no ref read during render.
 */
export function useListNavigation(options: UseListNavigationOptions): UseListNavigationResult {
  const { itemCount, columns = 1, loop = false, onActivate, getTypeaheadLabel, disabled } = options;

  const [rawActive, setRawActive] = useState<number>(() =>
    Math.min(Math.max(options.initialIndex ?? 0, 0), Math.max(itemCount - 1, 0)),
  );
  const activeIndex = itemCount === 0 ? 0 : Math.min(Math.max(rawActive, 0), itemCount - 1);

  const clamp = useCallback(
    (i: number) => {
      if (itemCount === 0) return 0;
      if (loop) return (i + itemCount) % itemCount;
      return Math.min(Math.max(i, 0), itemCount - 1);
    },
    [itemCount, loop],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (disabled || itemCount === 0 || isFromField(e)) return;
      const k = e.key;
      let next: number | null = null;

      if (k === "ArrowDown") next = clamp(activeIndex + columns);
      else if (k === "ArrowUp") next = clamp(activeIndex - columns);
      else if (columns > 1 && k === "ArrowRight") next = clamp(activeIndex + 1);
      else if (columns > 1 && k === "ArrowLeft") next = clamp(activeIndex - 1);
      else if (k === "Home") next = 0;
      else if (k === "End") next = itemCount - 1;
      else if (k === "Enter" || k === " ") {
        e.preventDefault();
        onActivate?.(activeIndex);
        return;
      } else if (getTypeaheadLabel && k.length === 1 && /\S/.test(k)) {
        const now = Date.now();
        taBuf = now - taAt > 600 ? k : taBuf + k;
        taAt = now;
        const q = taBuf.toLowerCase();
        for (let off = 1; off <= itemCount; off++) {
          const idx = (activeIndex + off) % itemCount;
          if (getTypeaheadLabel(idx).toLowerCase().startsWith(q)) {
            next = idx;
            break;
          }
        }
      }

      if (next !== null && next !== activeIndex) {
        e.preventDefault();
        setRawActive(next);
        const el = e.currentTarget.querySelector<HTMLElement>(`[data-nav-item="${next}"]`);
        if (el) {
          el.focus();
          el.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
      }
    },
    [disabled, itemCount, columns, activeIndex, clamp, onActivate, getTypeaheadLabel],
  );

  const getItemProps = useCallback(
    (index: number): ListItemProps => ({
      tabIndex: index === activeIndex ? 0 : -1,
      "data-active": index === activeIndex ? "" : undefined,
      "data-nav-item": index,
      onFocus: () => setRawActive(index),
      onClick: () => setRawActive(index),
    }),
    [activeIndex],
  );

  return { activeIndex, containerProps: { onKeyDown }, getItemProps };
}
