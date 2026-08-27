"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Minus,
  Plus,
  Search,
  Trash2,
  X,
  UtensilsCrossed,
  ShoppingBag,
  ClipboardList,
  ImageOff,
  Clock,
  CheckCheck,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bestPromotionForLine, type PromotionRule } from "@/lib/promotions";
import type { SaleResult } from "./actions";
import {
  createRestaurantOrder,
  markOrderServed,
  voidRestaurantOrder,
  type OpenOrderRow,
  type OrderType,
} from "./restaurant-actions";
import { CompleteOrderDialog } from "./complete-order-dialog";
import { QuickLinksMenu, buildQuickLinks, type QuickLinkFlags } from "./quick-links";
import {
  lineProductDiscount,
  lineSubtotal,
  lineTotal,
  unitPriceFor,
  type CartLine,
  type CategoryOption,
  type CustomerOption,
  type ProductForSale,
} from "./types";

const WALK_IN = "__walk_in__";

export interface TableOption {
  id: string;
  name: string;
  occupied: boolean;
}

function newLineFromProduct(product: ProductForSale): CartLine {
  return {
    key: `${product.id}-${Date.now()}-${Math.random()}`,
    productId: product.id,
    categoryId: product.categoryId,
    name: product.name,
    baseUnit: product.baseUnit,
    baseUnitName: product.baseUnitName,
    unitCode: product.baseUnit,
    unitName: product.baseUnitName,
    subUnit: product.subUnit,
    quantity: 1,
    sellingPrice: product.sellingPrice,
    taxRate: product.taxRate,
    discountType: product.discountType,
    discountValue: product.discountValue,
  };
}

function timeSince(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}

export function RestaurantScreen({
  products,
  categories,
  promotions,
  customers,
  tables,
  initialOpenOrders,
  canOverrideDiscountLimit,
  canApplyDiscount,
  taxInclusive,
  currencySymbol,
  quickLinks,
}: {
  products: ProductForSale[];
  categories: CategoryOption[];
  promotions: PromotionRule[];
  customers: CustomerOption[];
  tables: TableOption[];
  initialOpenOrders: OpenOrderRow[];
  canOverrideDiscountLimit: boolean;
  canApplyDiscount: boolean;
  taxInclusive: boolean;
  currencySymbol: string;
  quickLinks: QuickLinkFlags;
}) {
  const router = useRouter();
  const [view, setView] = useState<"new" | "orders">("new");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [tableId, setTableId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string>(WALK_IN);
  const [submitting, setSubmitting] = useState(false);
  const openOrders = initialOpenOrders;
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const now = useMemo(() => new Date(), []);
  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryId && product.categoryId !== categoryId) return false;
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q) ||
        (product.barcode ?? "").includes(q)
      );
    });
  }, [products, search, categoryId]);

  const linePromotions = useMemo(() => {
    const map = new Map<string, { promotionId: string; discountAmount: number }>();
    for (const line of cart) {
      const match = bestPromotionForLine(
        { productId: line.productId, categoryId: line.categoryId, quantity: line.quantity, unitPrice: unitPriceFor(line) },
        promotions,
        now,
      );
      if (match) {
        const cappedDiscount = Math.min(match.discountAmount, lineSubtotal(line) - lineProductDiscount(line));
        map.set(line.key, { ...match, discountAmount: cappedDiscount });
      }
    }
    return map;
  }, [cart, promotions, now]);

  const subtotal = cart.reduce((sum, line) => sum + lineSubtotal(line), 0);
  const productDiscountTotal = cart.reduce((sum, line) => sum + lineProductDiscount(line), 0);
  const promotionDiscountTotal = cart.reduce(
    (sum, line) => sum + (linePromotions.get(line.key)?.discountAmount ?? 0),
    0,
  );
  const taxTotal = cart.reduce((sum, line) => {
    const promo = linePromotions.get(line.key)?.discountAmount ?? 0;
    const net = lineSubtotal(line) - lineProductDiscount(line) - promo;
    const rate = line.taxRate;
    return sum + (taxInclusive ? net * (rate / (100 + rate)) : net * (rate / 100));
  }, 0);
  const grossAfterLineDiscounts = subtotal - productDiscountTotal - promotionDiscountTotal;
  const total = Math.max(0, taxInclusive ? grossAfterLineDiscounts : grossAfterLineDiscounts + taxTotal);

  function focusSearch() {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }

  useEffect(() => {
    focusSearch();
  }, []);

  function addProduct(product: ProductForSale) {
    setCart((prev) => {
      const existing = prev.find((line) => line.productId === product.id && line.unitCode === product.baseUnit);
      if (existing) {
        return prev.map((line) => (line.key === existing.key ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [...prev, newLineFromProduct(product)];
    });
  }

  function updateQuantity(key: string, quantity: number) {
    setCart((prev) => prev.map((line) => (line.key === key ? { ...line, quantity: Math.max(0, quantity) } : line)));
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((line) => line.key !== key));
  }

  function clearCart() {
    setCart([]);
    setTableId(null);
    setCustomerId(WALK_IN);
  }

  async function refreshOpenOrders() {
    router.refresh();
  }

  async function handleSendToKitchen() {
    if (cart.length === 0) return;
    if (orderType === "dine_in" && !tableId) {
      toast.error("Select a table for this dine-in order");
      return;
    }
    setSubmitting(true);
    try {
      const lines = cart.map((line) => ({ productId: line.productId, unitCode: line.unitCode, quantity: line.quantity }));
      const result = await createRestaurantOrder(
        orderType,
        orderType === "dine_in" ? tableId : null,
        lines,
        selectedCustomer?.id ?? null,
      );
      toast.success(`Order ${result.orderNumber} sent to kitchen`);
      if (window.pos?.isElectron) {
        for (const stationId of result.kotStations) {
          window.pos.printerAPI.printKOT(result.id, stationId).then((res) => {
            if (!res.success) toast.error(`KOT print failed: ${res.error ?? "unknown error"}`);
          });
        }
      }
      clearCart();
      setView("orders");
      await refreshOpenOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send order");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkServed(orderId: string) {
    try {
      await markOrderServed(orderId);
      toast.success("Marked as served");
      await refreshOpenOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update order");
    }
  }

  async function handleVoid(orderId: string) {
    if (!confirm("Void this order? Any deducted stock will be returned.")) return;
    try {
      await voidRestaurantOrder(orderId);
      toast.success("Order voided");
      await refreshOpenOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to void order");
    }
  }

  function handlePaySuccess(result: SaleResult) {
    setPayingOrderId(null);
    toast.success(`Order paid — sale ${result.saleNumber}`);
    if (window.pos?.isElectron) {
      window.pos.printerAPI.printReceipt(result.id).then((res) => {
        if (!res.success) toast.error(`Receipt print failed: ${res.error ?? "unknown error"}`);
      });
    } else {
      window.open(`/checkout/receipt/${result.id}`, "_blank");
    }
    refreshOpenOrders();
  }

  return (
    <div className="flex flex-1">
      {/* Cart / order-setup panel */}
      <div className="flex w-[420px] shrink-0 flex-col border-r border-border/60 bg-card/40">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <div className="flex gap-1 rounded-lg bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setView("new")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "new" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              New Order
            </button>
            <button
              type="button"
              onClick={() => setView("orders")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "orders" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              <ClipboardList className="size-5" />
              Open Orders
              {openOrders.length > 0 && <Badge variant="secondary">{openOrders.length}</Badge>}
            </button>
          </div>
          {view === "new" && cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCart}>
              <X /> Clear
            </Button>
          )}
        </div>

        {view === "new" ? (
          <>
            <div className="grid grid-cols-2 gap-2 border-b border-border/60 px-5 py-3">
              <Button
                type="button"
                variant={orderType === "dine_in" ? "default" : "outline"}
                onClick={() => setOrderType("dine_in")}
              >
                <UtensilsCrossed className="size-5" /> Dine In
              </Button>
              <Button
                type="button"
                variant={orderType === "take_away" ? "default" : "outline"}
                onClick={() => {
                  setOrderType("take_away");
                  setTableId(null);
                }}
              >
                <ShoppingBag className="size-5" /> Take Away
              </Button>
            </div>

            {orderType === "dine_in" && (
              <div className="border-b border-border/60 px-5 py-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Table</p>
                <div className="flex flex-wrap gap-1.5">
                  {tables.length === 0 && (
                    <p className="text-xs text-muted-foreground">No tables configured. Add tables in Settings.</p>
                  )}
                  {tables.map((table) => (
                    <button
                      key={table.id}
                      type="button"
                      disabled={table.occupied}
                      onClick={() => setTableId(table.id)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        tableId === table.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : table.occupied
                            ? "cursor-not-allowed border-border/40 bg-muted/40 text-muted-foreground/60"
                            : "border-border/60 bg-background hover:border-primary/50"
                      }`}
                    >
                      {table.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {customers.length > 0 && (
              <div className="border-b border-border/60 px-5 py-3">
                <Select value={customerId} onValueChange={(v) => setCustomerId(v ?? WALK_IN)}>
                  <SelectTrigger className="h-8 w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WALK_IN}>Walk-in customer</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                        {customer.isCreditCustomer ? " (credit)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-3 py-3">
              {cart.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Tap items to build this order.
                </p>
              ) : (
                <div className="grid gap-2">
                  {cart.map((line) => {
                    const promo = linePromotions.get(line.key);
                    const productDiscount = lineProductDiscount(line);
                    return (
                      <div key={line.key} className="rounded-lg border border-border/60 bg-card p-3 shadow-sm">
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{line.name}</p>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeLine(line.key)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-5" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="icon-xs" onClick={() => updateQuantity(line.key, line.quantity - 1)}>
                              <Minus className="size-4" />
                            </Button>
                            <Input
                              type="number"
                              value={line.quantity}
                              min="0"
                              step={1}
                              onChange={(e) => updateQuantity(line.key, Number(e.target.value))}
                              className="h-7 w-16 text-center text-sm"
                            />
                            <Button variant="outline" size="icon-xs" onClick={() => updateQuantity(line.key, line.quantity + 1)}>
                              <Plus className="size-4" />
                            </Button>
                          </div>
                          <span className="text-sm font-semibold">{lineTotal(line, taxInclusive).toFixed(2)}</span>
                        </div>
                        {productDiscount > 0 && (
                          <p className="mt-0.5 text-xs text-emerald-500">Product discount -{productDiscount.toFixed(2)}</p>
                        )}
                        {promo && <p className="mt-0.5 text-xs text-primary">Promotion -{promo.discountAmount.toFixed(2)}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-border/60 px-5 py-4">
              <div className="grid gap-1 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>{taxTotal.toFixed(2)}</span>
                </div>
              </div>
              <div className="my-3 flex items-baseline justify-between">
                <span className="text-base font-semibold">Total</span>
                <span className="text-2xl font-bold">
                  {currencySymbol}
                  {total.toFixed(2)}
                </span>
              </div>
              <Button className="h-12 w-full text-base" disabled={cart.length === 0 || submitting} onClick={handleSendToKitchen}>
                {submitting ? "Sending..." : "Send to Kitchen"}
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Payment is collected later from Open Orders, once served.
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {openOrders.length === 0 ? (
              <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                No open orders. Orders sent to the kitchen will appear here until paid.
              </p>
            ) : (
              <div className="grid gap-2">
                {openOrders.map((order) => (
                  <Card key={order.id} className="gap-0 py-3">
                    <CardContent className="grid gap-2 px-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold">{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.orderType === "dine_in" ? order.tableName ?? "Dine in" : "Take away"} · {order.itemCount} item
                            {order.itemCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <Badge variant={order.status === "served" ? "default" : "secondary"}>
                          {order.status === "served" ? "Served" : "Preparing"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-4" /> {timeSince(order.createdAt)}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {currencySymbol}
                          {order.total.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        {order.status === "open" && (
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => handleMarkServed(order.id)}>
                            <CheckCheck className="size-5" /> Served
                          </Button>
                        )}
                        <Button size="sm" className="flex-1" onClick={() => setPayingOrderId(order.id)}>
                          Complete &amp; Pay
                        </Button>
                        <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => handleVoid(order.id)}>
                          <Ban className="size-5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product panel */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border/60 px-6 py-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="h-11 pl-9 text-base"
            />
          </div>
          <QuickLinksMenu links={buildQuickLinks(quickLinks)} />
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border/60 px-6 py-3">
          <Button variant={categoryId === null ? "default" : "outline"} size="sm" onClick={() => setCategoryId(null)}>
            All
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={categoryId === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
            </Button>
          ))}
        </div>

        <div className="grid flex-1 auto-rows-max grid-cols-3 gap-3 overflow-y-auto p-6 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => addProduct(product)}
              className="flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md active:translate-y-0"
            >
              <div className="flex aspect-square items-center justify-center bg-muted/40">
                {product.imageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageDataUrl} alt="" className="size-full object-cover" />
                ) : (
                  <ImageOff className="size-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-0.5 p-2">
                <span className="line-clamp-2 text-xs font-medium">{product.name}</span>
                <span className="mt-auto text-sm font-semibold text-primary">
                  {currencySymbol}
                  {product.sellingPrice.toFixed(2)}
                </span>
              </div>
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-muted-foreground">No products match your search.</p>
          )}
        </div>
      </div>

      <CompleteOrderDialog
        orderId={payingOrderId}
        open={payingOrderId !== null}
        onOpenChange={(open) => !open && setPayingOrderId(null)}
        canOverrideDiscountLimit={canOverrideDiscountLimit}
        canApplyDiscount={canApplyDiscount}
        currencySymbol={currencySymbol}
        onSuccess={handlePaySuccess}
      />
    </div>
  );
}
