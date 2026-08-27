"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useListNavigation, type ListItemProps } from "@/hooks/use-list-navigation";

interface NavCtxValue {
  getItemProps: (index: number) => ListItemProps;
}

const NavCtx = createContext<NavCtxValue | null>(null);

/**
 * Roving keyboard navigation for a list or grid. Wrap the row container
 * (`<tbody>`, a `<div>` grid, …) and have each row call `useNavItem(index)`.
 *
 *   <NavList itemCount={rows.length} render={<TableBody />} getHref={(i) => `/x/${rows[i].id}`}>
 *     {rows.map((r, i) => <Row key={r.id} index={i} … />)}
 *   </NavList>
 */
export function NavList({
  itemCount,
  columns = 1,
  loop = false,
  render,
  className,
  children,
  onActivate,
  getHref,
  getTypeaheadLabel,
}: {
  itemCount: number;
  columns?: number;
  loop?: boolean;
  render?: ReactElement;
  className?: string;
  children: ReactNode;
  onActivate?: (index: number) => void;
  getHref?: (index: number) => string | null | undefined;
  getTypeaheadLabel?: (index: number) => string;
}) {
  const router = useRouter();
  const nav = useListNavigation({
    itemCount,
    columns,
    loop,
    getTypeaheadLabel,
    onActivate: (i) => {
      const href = getHref?.(i);
      if (href) router.push(href);
      else onActivate?.(i);
    },
  });

  const base = (
    isValidElement(render) ? render : <div role="listbox" />
  ) as ReactElement<Record<string, unknown>>;
  const baseClass = (base.props as { className?: string }).className;
  const merged = cloneElement(
    base,
    {
      ...nav.containerProps,
      className: [baseClass, className].filter(Boolean).join(" ") || undefined,
    },
    children,
  );

  return <NavCtx.Provider value={{ getItemProps: nav.getItemProps }}>{merged}</NavCtx.Provider>;
}

export function useNavItem(index: number): ListItemProps {
  const ctx = useContext(NavCtx);
  if (!ctx) {
    // Allows a row component to be used outside a NavList without crashing.
    return {
      tabIndex: -1,
      "data-active": undefined,
      "data-nav-item": index,
      onFocus: () => {},
      onClick: () => {},
    };
  }
  return ctx.getItemProps(index);
}
