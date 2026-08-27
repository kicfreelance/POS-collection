"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Keyboard,
  Printer,
  X,
  Tag,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bestPromotionForLine, type PromotionRule } from "@/lib/promotions";
import { cn } from "@/lib/utils";
import { PrinterPicker } from "@/components/printer-picker";
import { useListNavigation } from "@/hooks/use-list-navigation";
import { usePageShortcut } from "@/hooks/use-page-shortcut";
import { checkCoupon, type ManualDiscountInput, type SaleResult } from "./actions";
import { AddItemDialog, type AddItemResult } from "./add-item-dialog";
import { PayDialog } from "./pay-dialog";
import { ManualDiscountDialog } from "./manual-discount-dialog";
import { QuickLinksMenu, buildQuickLinks, type QuickLinkFlags } from "./quick-links";
import {
  lineProductDiscount,
  lineSubtotal,
  lineTax,
  lineTotal,
  unitPriceFor,
  type CartLine,
  type CategoryOption,
  type CustomerOption,
  type ProductForSale,
} from "./types";

const WALK_IN = "__walk_in__";

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
    subUnits: product.subUnits,
    quantity: 1,
    sellingPrice: product.sellingPrice,
    taxRate: product.taxRate,
    discountType: product.discountType,
    discountValue: product.discountValue,
    batchId: null,
    applyProductDiscount: true,
  };
}

function unitNameFor(product: ProductForSale, unitCode: string): string {
  if (unitCode === product.baseUnit) return product.baseUnitName;
  return product.subUnits.find((u) => u.code === unitCode)?.name ?? unitCode;
}

export function CheckoutScreen({
  products,
  categories,
  promotions,
  customers,
  canOverrideDiscountLimit,
  canApplyDiscount,
  taxInclusive,
  currencySymbol,
  receiptAutoPrint,
  quickLinks,
}: {
  products: ProductForSale[];
  categories: CategoryOption[];
  promotions: PromotionRule[];
  customers: CustomerOption[];
  canOverrideDiscountLimit: boolean;
  canApplyDiscount: boolean;
  taxInclusive: boolean;
  currencySymbol: string;
  receiptAutoPrint: boolean;
  quickLinks: QuickLinkFlags;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<SaleResult | null>(null);
  const [manualDiscount, setManualDiscount] = useState<ManualDiscountInput | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [customerId, setCustomerId] = useState<string>(WALK_IN);
  const [addItem, setAddItem] = useState<{ product: ProductForSale; line: CartLine | null } | null>(
    null,
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const now = useMemo(() => new Date(), []);
  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const barcodeIndex = useMemo(() => {
    const map = new Map<string, ProductForSale>();
    for (const product of products) {
      if (product.barcode) map.set(product.barcode, product);
    }
    return map;
  }, [products]);

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
    const map = new Map<string, { promotionId: string; promotionName: string; discountAmount: number }>();
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
  const preManualTotal = taxInclusive ? grossAfterLineDiscounts : grossAfterLineDiscounts + taxTotal;

  const manualDiscountAmount = manualDiscount
    ? Math.min(
        manualDiscount.type === "percentage"
          ? preManualTotal * (manualDiscount.value / 100)
          : manualDiscount.value,
        preManualTotal,
      )
    : 0;
  const afterManual = preManualTotal - manualDiscountAmount;
  const couponDiscountAmount = coupon ? Math.min(coupon.discountAmount, afterManual) : 0;
  const total = Math.max(0, afterManual - couponDiscountAmount);

  function focusSearch() {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }

  useEffect(() => {
    focusSearch();
  }, []);

  function addProduct(product: ProductForSale) {
    setAddItem({ product, line: null });
  }

  function editLine(line: CartLine) {
    const product = productsById.get(line.productId);
    if (!product) {
      toast.error("This product is no longer available — remove and re-add it.");
      return;
    }
    setAddItem({ product, line });
  }

  function handleAddItemSubmit(result: AddItemResult) {
    if (!addItem) return;
    const { product, line: editing } = addItem;
    const unitName = unitNameFor(product, result.unitCode);

    setCart((prev) => {
      if (editing) {
        return prev.map((l) =>
          l.key === editing.key
            ? {
                ...l,
                unitCode: result.unitCode,
                unitName,
                quantity: result.quantity,
                batchId: result.batchId,
                applyProductDiscount: result.applyProductDiscount,
              }
            : l,
        );
      }
      const existing = prev.find(
        (l) =>
          l.productId === product.id &&
          l.unitCode === result.unitCode &&
          l.batchId === result.batchId &&
          l.applyProductDiscount === result.applyProductDiscount,
      );
      if (existing) {
        return prev.map((l) =>
          l.key === existing.key ? { ...l, quantity: l.quantity + result.quantity } : l,
        );
      }
      return [
        ...prev,
        {
          ...newLineFromProduct(product),
          unitCode: result.unitCode,
          unitName,
          quantity: result.quantity,
          batchId: result.batchId,
          applyProductDiscount: result.applyProductDiscount,
        },
      ];
    });
    setAddItem(null);
    focusSearch();
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    const code = search.trim();
    if (!code) return;

    const barcodeMatch = barcodeIndex.get(code);
    if (barcodeMatch) {
      addProduct(barcodeMatch);
      setSearch("");
      return;
    }

    if (filteredProducts.length === 1) {
      addProduct(filteredProducts[0]);
      setSearch("");
    }
  }

  function updateQuantity(key: string, quantity: number) {
    setCart((prev) =>
      prev.map((line) => (line.key === key ? { ...line, quantity: Math.max(0, quantity) } : line)),
    );
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((line) => line.key !== key));
  }

  function clearCart() {
    setCart([]);
    setCompletedSale(null);
    setManualDiscount(null);
    setCoupon(null);
    setCouponInput("");
    setCustomerId(WALK_IN);
  }

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setCouponChecking(true);
    try {
      const result = await checkCoupon(couponInput.trim(), afterManual);
      if (!result.valid) {
        toast.error(result.error);
        return;
      }
      setCoupon({ code: couponInput.trim(), discountAmount: result.discountAmount });
      toast.success("Coupon applied");
    } finally {
      setCouponChecking(false);
    }
  }

  const gridNav = useListNavigation({
    itemCount: filteredProducts.length,
    columns: 5,
    onActivate: (i) => addProduct(filteredProducts[i]),
    getTypeaheadLabel: (i) => filteredProducts[i].name,
  });
  const cartNav = useListNavigation({
    itemCount: cart.length,
    onActivate: (i) => editLine(cart[i]),
  });

  usePageShortcut({
    keys: "F2",
    label: "New sale (clear cart)",
    group: "Checkout",
    run: () => {
      clearCart();
      focusSearch();
    },
  });
  usePageShortcut({
    keys: "F9",
    label: "Pay",
    group: "Checkout",
    run: () => {
      if (cart.length > 0) setPayOpen(true);
    },
  });
  usePageShortcut({
    keys: "Enter",
    label: "Add / edit the highlighted item",
    group: "Checkout",
    run: () => {},
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        clearCart();
        focusSearch();
      } else if (event.key === "F9") {
        event.preventDefault();
        if (cart.length > 0) setPayOpen(true);
      } else if (event.key === "Escape") {
        if (payOpen) setPayOpen(false);
        else focusSearch();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.length, payOpen]);

  function handlePaySuccess(result: SaleResult) {
    setCompletedSale(result);
    setCart([]);
    setManualDiscount(null);
    setCoupon(null);
    setCouponInput("");
    setCustomerId(WALK_IN);
    setPayOpen(false);
    toast.success(`Sale ${result.saleNumber} completed`);

    if (receiptAutoPrint && typeof window !== "undefined" && window.pos?.isElectron) {
      window.pos.printerAPI.printReceipt(result.id).then((res) => {
        if (!res.success) toast.error(`Receipt print failed: ${res.error ?? "unknown error"}`);
      });
    }
  }

  const cartLinesForPayment = cart.map((line) => ({
    productId: line.productId,
    unitCode: line.unitCode,
    quantity: line.quantity,
    batchId: line.batchId,
    applyProductDiscount: line.applyProductDiscount,
  }));

  return (
    <div className="flex flex-1">
      {/* Cart panel */}
      <div className="flex w-[400px] shrink-0 flex-col border-r border-border/70 bg-card">
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-5 text-primary" />
            <h2 className="text-lg font-bold">Current Order</h2>
          </div>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCart}>
              <X /> Clear (F2)
            </Button>
          )}
        </div>

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
          {completedSale ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-500">
                <ShoppingCart className="size-8" />
              </div>
              <div>
                <p className="text-lg font-semibold">Sale {completedSale.saleNumber} complete</p>
                <p className="text-sm text-muted-foreground">Total {completedSale.total.toFixed(2)}</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <PrinterPicker
                  label="Print receipt"
                  storageKey="receipt"
                  variant="outline"
                  onPrint={(deviceName) =>
                    window.pos!.printerAPI.printReceipt(completedSale.id, deviceName)
                  }
                />
                <Button
                  variant="outline"
                  onClick={() => window.open(`/checkout/receipt/${completedSale.id}`, "_blank")}
                >
                  <Printer /> Preview
                </Button>
                <Button onClick={() => setCompletedSale(null)}>New Sale</Button>
              </div>
            </div>
          ) : cart.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Scan or select a product to start a sale.
            </p>
          ) : (
            <div className="grid gap-2" {...cartNav.containerProps}>
              {cart.map((line, i) => {
                const promo = linePromotions.get(line.key);
                const productDiscount = lineProductDiscount(line);
                const nudge = line.unitCode === line.baseUnit && line.baseUnit !== "pcs" ? 0.1 : 1;
                const stop = (e: React.SyntheticEvent) => e.stopPropagation();
                const navProps = cartNav.getItemProps(i);
                return (
                  <div
                    key={line.key}
                    role="button"
                    {...navProps}
                    onClick={() => {
                      navProps.onClick();
                      editLine(line);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Delete" || e.key === "Backspace") {
                        e.preventDefault();
                        removeLine(line.key);
                      }
                    }}
                    className="cursor-pointer rounded-2xl border border-border/70 bg-card p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active]:border-primary data-[active]:ring-2 data-[active]:ring-primary/40"
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{line.name}</p>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => {
                          stop(e);
                          removeLine(line.key);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-5" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5" onClick={stop}>
                        <Button
                          variant="outline"
                          size="icon-xs"
                          onClick={(e) => {
                            stop(e);
                            updateQuantity(line.key, line.quantity - nudge);
                          }}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <Input
                          type="number"
                          value={line.quantity}
                          min="0"
                          step={line.unitCode === line.baseUnit && line.baseUnit !== "pcs" ? 0.01 : 1}
                          onChange={(e) => updateQuantity(line.key, Number(e.target.value))}
                          className="h-7 w-16 text-center text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon-xs"
                          onClick={(e) => {
                            stop(e);
                            updateQuantity(line.key, line.quantity + nudge);
                          }}
                        >
                          <Plus className="size-4" />
                        </Button>
                        <button
                          type="button"
                          onClick={(e) => {
                            stop(e);
                            editLine(line);
                          }}
                          className="ml-1 rounded border border-border/60 px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {line.unitName}
                        </button>
                      </div>
                      <span className="text-sm font-semibold">{lineTotal(line, taxInclusive).toFixed(2)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {unitPriceFor(line).toFixed(2)} / {line.unitName}
                      {line.taxRate > 0 && ` · tax ${lineTax(line, taxInclusive).toFixed(2)}`}
                    </p>
                    {productDiscount > 0 && (
                      <p className="mt-0.5 text-xs text-emerald-500">
                        Product discount -{productDiscount.toFixed(2)}
                      </p>
                    )}
                    {promo && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-primary">
                        <Tag className="size-4" /> {promo.promotionName} -{promo.discountAmount.toFixed(2)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border/60 px-5 py-4">
          {canApplyDiscount && cart.length > 0 && (
            <div className="mb-3 flex items-center gap-2">
              <ManualDiscountDialog
                canOverrideLimit={canOverrideDiscountLimit}
                currentDiscount={manualDiscount}
                onApply={setManualDiscount}
                onClear={() => setManualDiscount(null)}
              />
              {!coupon ? (
                <div className="flex flex-1 gap-1.5">
                  <Input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Coupon code"
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="outline" disabled={couponChecking} onClick={applyCoupon}>
                    <Ticket className="size-5" />
                  </Button>
                </div>
              ) : (
                <Badge variant="secondary" className="flex-1 justify-between">
                  {coupon.code}
                  <button type="button" onClick={() => setCoupon(null)} className="ml-2">
                    <X className="size-3.5" />
                  </button>
                </Badge>
              )}
            </div>
          )}

          <div className="rounded-2xl bg-muted p-4">
            <div className="grid gap-1.5 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium text-foreground">{subtotal.toFixed(2)}</span>
              </div>
              {productDiscountTotal > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Product discounts</span>
                  <span>-{productDiscountTotal.toFixed(2)}</span>
                </div>
              )}
              {promotionDiscountTotal > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Promotions</span>
                  <span>-{promotionDiscountTotal.toFixed(2)}</span>
                </div>
              )}
              {manualDiscountAmount > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Manual discount</span>
                  <span>-{manualDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              {couponDiscountAmount > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Coupon</span>
                  <span>-{couponDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax</span>
                <span className="font-medium text-foreground">{taxTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-border/70 pt-3">
              <span className="text-base font-bold">Total</span>
              <span className="text-2xl font-bold">
                {currencySymbol}
                {total.toFixed(2)}
              </span>
            </div>
          </div>
          <Button
            className="mt-4 h-14 w-full text-base"
            disabled={cart.length === 0}
            onClick={() => setPayOpen(true)}
          >
            Pay (F9)
          </Button>
        </div>
      </div>

      {/* Product panel */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 px-6 pt-6 pb-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              data-primary-search
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Scan barcode or search products..."
              className="h-12 rounded-full pl-11 text-base"
              autoFocus
            />
          </div>
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="outline" size="icon" className="size-12">
                  <Keyboard />
                </Button>
              }
            />
            <PopoverContent align="end" className="w-72 text-sm">
              <p className="mb-2 font-medium">Keyboard shortcuts</p>
              <ul className="grid gap-1 text-muted-foreground">
                <li className="flex justify-between gap-3"><span>New sale</span><Badge variant="outline">F2</Badge></li>
                <li className="flex justify-between gap-3"><span>Pay</span><Badge variant="outline">F9</Badge></li>
                <li className="flex justify-between gap-3"><span>Move product grid / cart</span><Badge variant="outline">arrows</Badge></li>
                <li className="flex justify-between gap-3"><span>Add / edit highlighted item</span><Badge variant="outline">Enter</Badge></li>
                <li className="flex justify-between gap-3"><span>Set quantity</span><Badge variant="outline">type a number</Badge></li>
                <li className="flex justify-between gap-3"><span>Switch unit (in popup)</span><Badge variant="outline">← / →</Badge></li>
                <li className="flex justify-between gap-3"><span>Pick batch (in popup)</span><Badge variant="outline">↑ / ↓</Badge></li>
                <li className="flex justify-between gap-3"><span>Remove highlighted line</span><Badge variant="outline">Del</Badge></li>
                <li className="flex justify-between gap-3"><span>Cancel / focus search</span><Badge variant="outline">Esc</Badge></li>
                <li className="flex justify-between gap-3"><span>All shortcuts</span><Badge variant="outline">?</Badge></li>
              </ul>
            </PopoverContent>
          </Popover>
          <QuickLinksMenu links={buildQuickLinks(quickLinks)} />
        </div>

        <div className="flex flex-wrap gap-2 px-6 py-4">
          {[{ id: null as string | null, name: "All" }, ...categories].map((category) => {
            const active = categoryId === category.id;
            return (
              <button
                key={category.id ?? "__all__"}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={cn(
                  "h-9 rounded-full px-5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "bg-card text-foreground/70 shadow-[var(--shadow-card)] hover:text-foreground",
                )}
              >
                {category.name}
              </button>
            );
          })}
        </div>

        <div
          {...gridNav.containerProps}
          className="grid flex-1 auto-rows-max grid-cols-2 gap-4 overflow-y-auto px-6 pb-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          {filteredProducts.map((product, idx) => (
            <button
              key={product.id}
              type="button"
              {...gridNav.getItemProps(idx)}
              onClick={() => addProduct(product)}
              className="group/tile flex flex-col rounded-2xl bg-card p-3 text-left shadow-[var(--shadow-card)] outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0 data-[active]:ring-2 data-[active]:ring-primary/60"
            >
              <div className="mb-3 aspect-[4/3] w-full rounded-xl bg-muted" />
              <span className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</span>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-sm font-bold">
                  {currencySymbol}
                  {product.sellingPrice.toFixed(2)}
                </span>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform group-hover/tile:scale-105">
                  <Plus className="size-4" />
                </span>
              </div>
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
              No products match your search.
            </p>
          )}
        </div>
      </div>

      <PayDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        total={total}
        lines={cartLinesForPayment}
        manualDiscount={manualDiscount}
        couponCode={coupon?.code ?? null}
        customerId={selectedCustomer?.id ?? null}
        customerName={selectedCustomer?.name ?? null}
        isCreditCustomer={selectedCustomer?.isCreditCustomer ?? false}
        onSuccess={handlePaySuccess}
      />

      {addItem && (
        <AddItemDialog
          key={`${addItem.product.id}:${addItem.line?.key ?? "new"}`}
          open
          onOpenChange={(next) => {
            if (!next) {
              setAddItem(null);
              focusSearch();
            }
          }}
          product={addItem.product}
          editingLine={addItem.line}
          currencySymbol={currencySymbol}
          taxInclusive={taxInclusive}
          onSubmit={handleAddItemSubmit}
        />
      )}
    </div>
  );
}
