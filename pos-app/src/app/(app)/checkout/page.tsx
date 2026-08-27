import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import type { PromotionRule } from "@/lib/promotions";
import { getBusinessSettings } from "@/lib/settings-server";
import { CheckoutScreen } from "./checkout-screen";
import { RestaurantScreen, type TableOption } from "./restaurant-screen";
import { listOpenRestaurantOrders } from "./restaurant-actions";
import type { CategoryOption, ProductForSale } from "./types";
import { StartShiftScreen } from "../shifts/start-shift-screen";

export const dynamic = "force-dynamic";

interface ProductQueryRow {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  base_unit: string;
  base_unit_name: string;
  selling_price: string;
  tax_rate: string;
  discount_type: "percentage" | "flat" | null;
  discount_value: string | null;
  sub_unit: string | null;
  sub_unit_name: string | null;
  sub_unit_factor: string | null;
  image_data_url: string | null;
}

interface PromotionQueryRow {
  id: string;
  name: string;
  type: PromotionRule["type"];
  target_type: PromotionRule["targetType"];
  target_id: string;
  value: string | null;
  buy_quantity: number | null;
  get_quantity: number | null;
  get_discount_percent: string | null;
  bundle_quantity: number | null;
  bundle_price: string | null;
  start_at: string | null;
  end_at: string | null;
  recurring_days_of_week: number[] | null;
}

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "sales.create")) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">
        You do not have permission to use the checkout screen.
      </div>
    );
  }

  const { rows: openShiftRows } = await pool.query(
    `SELECT id FROM shifts WHERE cashier_id = $1 AND status = 'open'`,
    [user.id],
  );
  if (openShiftRows.length === 0) {
    return <StartShiftScreen />;
  }

  const settings = await getBusinessSettings();

  const [{ rows: productRows }, { rows: categories }, { rows: promoRows }, { rows: customers }] =
    await Promise.all([
      pool.query<ProductQueryRow>(
        `SELECT p.id, p.name, p.sku, p.barcode, p.category_id, p.base_unit,
                bu.name AS base_unit_name, p.selling_price, p.tax_rate, p.discount_type, p.discount_value,
                uc.sub_unit, su.name AS sub_unit_name, uc.factor AS sub_unit_factor, p.image_data_url
         FROM products p
         JOIN units bu ON bu.code = p.base_unit
         LEFT JOIN unit_conversions uc ON uc.base_unit = p.base_unit
         LEFT JOIN units su ON su.code = uc.sub_unit
         WHERE p.is_active = true
         ORDER BY p.name`,
      ),
      pool.query<CategoryOption>(`SELECT id, name FROM categories ORDER BY name`),
      pool.query<PromotionQueryRow>(`SELECT * FROM promotions WHERE is_active = true`),
      pool.query<{ id: string; name: string; is_credit_customer: boolean }>(
        `SELECT id, name, is_credit_customer FROM customers ORDER BY name`,
      ),
    ]);

  const products: ProductForSale[] = productRows.map((row) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    categoryId: row.category_id,
    baseUnit: row.base_unit,
    baseUnitName: row.base_unit_name,
    sellingPrice: Number(row.selling_price),
    taxRate: Number(row.tax_rate),
    discountType: row.discount_type,
    discountValue: row.discount_value != null ? Number(row.discount_value) : null,
    subUnit: row.sub_unit
      ? { code: row.sub_unit, name: row.sub_unit_name ?? row.sub_unit, factor: Number(row.sub_unit_factor) }
      : null,
    imageDataUrl: row.image_data_url,
  }));

  const promotions: PromotionRule[] = promoRows.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    targetType: p.target_type,
    targetId: p.target_id,
    value: p.value != null ? Number(p.value) : null,
    buyQuantity: p.buy_quantity,
    getQuantity: p.get_quantity,
    getDiscountPercent: p.get_discount_percent != null ? Number(p.get_discount_percent) : null,
    bundleQuantity: p.bundle_quantity,
    bundlePrice: p.bundle_price != null ? Number(p.bundle_price) : null,
    startAt: p.start_at,
    endAt: p.end_at,
    recurringDaysOfWeek: p.recurring_days_of_week,
  }));

  const customerOptions = customers.map((c) => ({ id: c.id, name: c.name, isCreditCustomer: c.is_credit_customer }));

  const quickLinks = {
    products: hasPermission(user, "products.view"),
    inventory: hasPermission(user, "inventory.view"),
    customers: hasPermission(user, "customers.view"),
    shifts: hasPermission(user, "shifts.open_close") || hasPermission(user, "reports.view"),
    reports: hasPermission(user, "reports.view"),
  };

  if (settings.businessType === "restaurant") {
    const [{ rows: tableRows }, openOrders] = await Promise.all([
      pool.query<{ id: string; name: string; occupied: boolean }>(
        `SELECT t.id, t.name,
                EXISTS (
                  SELECT 1 FROM restaurant_orders o
                  WHERE o.table_id = t.id AND o.status IN ('open', 'served')
                ) AS occupied
         FROM restaurant_tables t
         WHERE t.is_active = true
         ORDER BY t.name`,
      ),
      listOpenRestaurantOrders(),
    ]);

    const tables: TableOption[] = tableRows.map((t) => ({ id: t.id, name: t.name, occupied: t.occupied }));

    return (
      <RestaurantScreen
        products={products}
        categories={categories}
        promotions={promotions}
        customers={customerOptions}
        tables={tables}
        initialOpenOrders={openOrders}
        canOverrideDiscountLimit={hasPermission(user, "discounts.override_limit")}
        canApplyDiscount={hasPermission(user, "discounts.apply")}
        taxInclusive={settings.taxInclusivePricing}
        currencySymbol={settings.currencySymbol}
        quickLinks={quickLinks}
      />
    );
  }

  return (
    <CheckoutScreen
      products={products}
      categories={categories}
      promotions={promotions}
      customers={customerOptions}
      canOverrideDiscountLimit={hasPermission(user, "discounts.override_limit")}
      canApplyDiscount={hasPermission(user, "discounts.apply")}
      taxInclusive={settings.taxInclusivePricing}
      currencySymbol={settings.currencySymbol}
      receiptAutoPrint={settings.receiptAutoPrint}
      quickLinks={quickLinks}
    />
  );
}
