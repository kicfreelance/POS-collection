"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Tag, Power, PowerOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NavList, useNavItem } from "@/components/nav-list";
import { useRegisterNewAction } from "@/hooks/use-page-shortcut";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setProductActive } from "./actions";

export interface ProductListRow {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_name: string | null;
  base_unit: string;
  selling_price: string;
  is_active: boolean;
}

export function ProductsTable({
  products,
  canManage,
}: {
  products: ProductListRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useRegisterNewAction(() => {
    if (canManage) router.push("/products/new");
  }, "New product");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  return (
    <div className="grid gap-4">
      <Input
        data-primary-search
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name, SKU, or barcode..."
        className="max-w-sm"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Barcode</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Status</TableHead>
            {canManage && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <NavList
          render={<TableBody />}
          itemCount={filtered.length}
          getHref={(i) => (canManage ? `/products/${filtered[i].id}/edit` : null)}
          getTypeaheadLabel={(i) => filtered[i].name}
        >
          {filtered.map((product, i) => (
            <ProductRow key={product.id} index={i} product={product} canManage={canManage} />
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={canManage ? 8 : 7} className="text-center text-muted-foreground">
                No products found.
              </TableCell>
            </TableRow>
          )}
        </NavList>
      </Table>
    </div>
  );
}

function ProductRow({
  product,
  canManage,
  index,
}: {
  product: ProductListRow;
  canManage: boolean;
  index: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const navItem = useNavItem(index);

  function handleToggleActive() {
    startTransition(async () => {
      try {
        await setProductActive(product.id, !product.is_active);
        toast.success(product.is_active ? `${product.name} deactivated` : `${product.name} activated`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update product");
      }
    });
  }

  return (
    <TableRow
      {...navItem}
      onClick={() => {
        navItem.onClick();
        if (canManage) router.push(`/products/${product.id}/edit`);
      }}
      className={cn(
        "outline-none data-[active]:bg-accent/60",
        canManage && "cursor-pointer",
      )}
    >
      <TableCell className="font-medium">{product.name}</TableCell>
      <TableCell className="text-muted-foreground">{product.sku}</TableCell>
      <TableCell className="text-muted-foreground">{product.barcode ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{product.category_name ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{product.base_unit}</TableCell>
      <TableCell>{Number(product.selling_price).toFixed(2)}</TableCell>
      <TableCell>
        <Badge variant={product.is_active ? "secondary" : "outline"}>
          {product.is_active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      {canManage && (
        <TableCell onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                render={<Link href={`/products/${product.id}/edit`} />}
              >
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`/products/${product.id}/label`} />}>
                <Tag /> Print label
              </DropdownMenuItem>
              <DropdownMenuItem
                variant={product.is_active ? "destructive" : "default"}
                disabled={isPending}
                onClick={handleToggleActive}
              >
                {product.is_active ? <PowerOff /> : <Power />}
                {product.is_active ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      )}
    </TableRow>
  );
}
