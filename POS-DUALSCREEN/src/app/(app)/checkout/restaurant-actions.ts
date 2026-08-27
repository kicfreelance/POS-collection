"use server";

import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { deductStockFifo } from "@/lib/inventory-server";
import { verifyApprovalToken } from "@/lib/auth/session";
import { getBusinessSettings } from "@/lib/settings-server";
import {
  bestPromotionForLine,
  productDiscountAmount,
  validateCoupon,
  MANUAL_DISCOUNT_LIMIT_PERCENT,
  type PromotionRule,
} from "@/lib/promotions";
import type { CartLineInput, ManualDiscountInput, PaymentInput, SaleResult } from "./actions";

export type OrderType = "dine_in" | "take_away";

export interface RestaurantOrderResult {
  id: string;
  orderNumber: string;
  total: number;
  kotStations: (string | null)[];
}

export interface OpenOrderRow {
  id: string;
  orderNumber: string;
  orderType: OrderType;
  tableName: string | null;
  status: "open" | "served";
  total: number;
  itemCount: number;
  createdAt: string;
}

async function requireOpenShift(userId: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM shifts WHERE cashier_id = $1 AND status = 'open'`,
    [userId],
  );
  if (!rows[0]) throw new Error("Open a shift before taking orders");
  return rows[0].id;
}

export async function createRestaurantOrder(
  orderType: OrderType,
  tableId: string | null,
  lines: CartLineInput[],
  customerId: string | null,
): Promise<RestaurantOrderResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "sales.create")) {
    throw new Error("You do not have permission to take orders");
  }
  if (lines.length === 0) throw new Error("Order is empty");
  if (orderType === "dine_in" && !tableId) throw new Error("Select a table for a dine-in order");
  if (orderType === "take_away" && tableId) throw new Error("Take-away orders cannot have a table");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const shiftId = await requireOpenShift(user.id);

    if (tableId) {
      const { rows: tableRows } = await client.query<{ is_active: boolean }>(
        `SELECT is_active FROM restaurant_tables WHERE id = $1 FOR UPDATE`,
        [tableId],
      );
      if (!tableRows[0] || !tableRows[0].is_active) throw new Error("Table not found or inactive");

      const { rows: existing } = await client.query(
        `SELECT id FROM restaurant_orders WHERE table_id = $1 AND status IN ('open', 'served')`,
        [tableId],
      );
      if (existing.length > 0) throw new Error("This table already has an open order");
    }

    const { rows: promoRows } = await client.query<{
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
    }>(`SELECT * FROM promotions WHERE is_active = true`);

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

    const now = new Date();
    const settings = await getBusinessSettings();

    let subtotal = 0;
    let productDiscountTotal = 0;
    let promotionDiscountTotal = 0;
    let taxTotal = 0;

    const computedLines: {
      productId: string;
      name: string;
      quantity: number;
      baseQuantity: number;
      unitCode: string;
      unitPrice: number;
      lineSubtotal: number;
      lineProductDiscount: number;
      lineTax: number;
      lineTotal: number;
      promotionId: string | null;
      stationId: string | null;
    }[] = [];

    for (const line of lines) {
      const { rows } = await client.query<{
        id: string;
        name: string;
        category_id: string | null;
        base_unit: string;
        selling_price: string;
        tax_rate: string;
        discount_type: "percentage" | "flat" | null;
        discount_value: string | null;
        is_active: boolean;
        station_id: string | null;
      }>(
        `SELECT p.id, p.name, p.category_id, p.base_unit, p.selling_price, p.tax_rate, p.discount_type, p.discount_value, p.is_active,
                COALESCE(p.station_id, c.station_id) AS station_id
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.id = $1`,
        [line.productId],
      );
      const product = rows[0];
      if (!product || !product.is_active) {
        throw new Error("A product in the order is no longer available");
      }
      if (line.quantity <= 0) throw new Error(`Invalid quantity for ${product.name}`);

      let unitPrice: number;
      let baseQuantity: number;
      if (line.unitCode === product.base_unit) {
        unitPrice = Number(product.selling_price);
        baseQuantity = line.quantity;
      } else {
        const { rows: convRows } = await client.query<{ factor: string }>(
          `SELECT factor FROM unit_conversions WHERE base_unit = $1 AND sub_unit = $2`,
          [product.base_unit, line.unitCode],
        );
        const conversion = convRows[0];
        if (!conversion) throw new Error(`Invalid unit for ${product.name}`);
        const factor = Number(conversion.factor);
        unitPrice = Number(product.selling_price) / factor;
        baseQuantity = line.quantity / factor;
      }

      const lineSub = Math.round(unitPrice * line.quantity * 100) / 100;
      const productDiscount = productDiscountAmount(
        product.discount_type,
        product.discount_value != null ? Number(product.discount_value) : null,
        lineSub,
      );

      const promoMatch = bestPromotionForLine(
        { productId: product.id, categoryId: product.category_id, quantity: line.quantity, unitPrice },
        promotions,
        now,
      );
      const promotionDiscount = Math.min(promoMatch?.discountAmount ?? 0, lineSub - productDiscount);

      const netLine = lineSub - productDiscount - promotionDiscount;
      const rate = Number(product.tax_rate);
      const lineTaxAmount = settings.taxInclusivePricing
        ? Math.round(netLine * (rate / (100 + rate)) * 100) / 100
        : Math.round(netLine * (rate / 100) * 100) / 100;
      const lineTotalAmount = settings.taxInclusivePricing ? netLine : netLine + lineTaxAmount;

      subtotal += lineSub;
      productDiscountTotal += productDiscount;
      promotionDiscountTotal += promotionDiscount;
      taxTotal += lineTaxAmount;

      computedLines.push({
        productId: product.id,
        name: product.name,
        quantity: line.quantity,
        baseQuantity,
        unitCode: line.unitCode,
        unitPrice,
        lineSubtotal: lineSub,
        lineProductDiscount: productDiscount,
        lineTax: lineTaxAmount,
        lineTotal: lineTotalAmount,
        promotionId: promoMatch?.promotionId ?? null,
        stationId: product.station_id,
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    productDiscountTotal = Math.round(productDiscountTotal * 100) / 100;
    promotionDiscountTotal = Math.round(promotionDiscountTotal * 100) / 100;
    taxTotal = Math.round(taxTotal * 100) / 100;
    const grossAfterLineDiscounts = Math.round((subtotal - productDiscountTotal - promotionDiscountTotal) * 100) / 100;
    const total = settings.taxInclusivePricing
      ? grossAfterLineDiscounts
      : Math.round((grossAfterLineDiscounts + taxTotal) * 100) / 100;

    const { rows: numberRows } = await client.query<{ nextval: string }>(
      "SELECT nextval('restaurant_order_number_seq')",
    );
    const orderNumber = `ORD-${numberRows[0].nextval.padStart(6, "0")}`;

    const { rows: orderRows } = await client.query<{ id: string }>(
      `INSERT INTO restaurant_orders
        (order_number, order_type, table_id, cashier_id, shift_id, customer_id,
         subtotal, product_discount_amount, promotion_discount_amount, tax_total, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        orderNumber,
        orderType,
        tableId,
        user.id,
        shiftId,
        customerId,
        subtotal,
        productDiscountTotal,
        promotionDiscountTotal,
        taxTotal,
        total,
      ],
    );
    const orderId = orderRows[0].id;

    for (const line of computedLines) {
      const { rows: itemRows } = await client.query<{ id: string }>(
        `INSERT INTO restaurant_order_items
          (order_id, product_id, product_name, quantity, unit_code, unit_price, line_subtotal, line_discount, line_tax, line_total, promotion_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [
          orderId,
          line.productId,
          line.name,
          line.quantity,
          line.unitCode,
          line.unitPrice,
          line.lineSubtotal,
          line.lineProductDiscount,
          line.lineTax,
          line.lineTotal,
          line.promotionId,
        ],
      );
      const orderItemId = itemRows[0].id;

      const consumed = await deductStockFifo(client, line.productId, line.baseQuantity);
      for (const batch of consumed) {
        await client.query(
          `INSERT INTO restaurant_order_item_batches (order_item_id, batch_id, quantity, cost_price) VALUES ($1,$2,$3,$4)`,
          [orderItemId, batch.batchId, batch.quantity, batch.costPrice],
        );
      }
    }

    await client.query("COMMIT");
    const kotStations = [...new Set(computedLines.map((line) => line.stationId))];
    return { id: orderId, orderNumber, total, kotStations };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function markOrderServed(orderId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "sales.create")) {
    throw new Error("You do not have permission to update orders");
  }
  const { rows } = await pool.query<{ status: string }>(
    `SELECT status FROM restaurant_orders WHERE id = $1`,
    [orderId],
  );
  if (!rows[0]) throw new Error("Order not found");
  if (rows[0].status !== "open") throw new Error("Order is not awaiting service");

  await pool.query(`UPDATE restaurant_orders SET status = 'served', served_at = now() WHERE id = $1`, [orderId]);
}

export async function voidRestaurantOrder(orderId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "sales.create")) {
    throw new Error("You do not have permission to void orders");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ status: string }>(
      `SELECT status FROM restaurant_orders WHERE id = $1 FOR UPDATE`,
      [orderId],
    );
    if (!rows[0]) throw new Error("Order not found");
    if (rows[0].status !== "open" && rows[0].status !== "served") {
      throw new Error("Only open or served orders can be voided");
    }

    const { rows: batchRows } = await client.query<{ batch_id: string; quantity: string }>(
      `SELECT rb.batch_id, rb.quantity
       FROM restaurant_order_item_batches rb
       JOIN restaurant_order_items ri ON ri.id = rb.order_item_id
       WHERE ri.order_id = $1`,
      [orderId],
    );
    for (const batch of batchRows) {
      await client.query(`UPDATE batches SET quantity_remaining = quantity_remaining + $1 WHERE id = $2`, [
        Number(batch.quantity),
        batch.batch_id,
      ]);
    }

    await client.query(`UPDATE restaurant_orders SET status = 'voided', voided_at = now() WHERE id = $1`, [orderId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listOpenRestaurantOrders(): Promise<OpenOrderRow[]> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "sales.create")) return [];

  const { rows } = await pool.query<{
    id: string;
    order_number: string;
    order_type: OrderType;
    table_name: string | null;
    status: "open" | "served";
    total: string;
    item_count: string;
    created_at: string;
  }>(
    `SELECT o.id, o.order_number, o.order_type, t.name AS table_name, o.status, o.total, o.created_at,
            (SELECT COUNT(*) FROM restaurant_order_items ri WHERE ri.order_id = o.id) AS item_count
     FROM restaurant_orders o
     LEFT JOIN restaurant_tables t ON t.id = o.table_id
     WHERE o.status IN ('open', 'served')
     ORDER BY o.created_at ASC`,
  );

  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    orderType: r.order_type,
    tableName: r.table_name,
    status: r.status,
    total: Number(r.total),
    itemCount: Number(r.item_count),
    createdAt: r.created_at,
  }));
}

export interface OrderForPayment {
  id: string;
  orderNumber: string;
  total: number;
  customerId: string | null;
  customerName: string | null;
  isCreditCustomer: boolean;
}

export async function getOrderForPayment(orderId: string): Promise<OrderForPayment> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "sales.create")) {
    throw new Error("You do not have permission to view this order");
  }

  const { rows } = await pool.query<{
    id: string;
    order_number: string;
    total: string;
    status: string;
    customer_id: string | null;
    customer_name: string | null;
    is_credit_customer: boolean | null;
  }>(
    `SELECT o.id, o.order_number, o.total, o.status, o.customer_id,
            c.name AS customer_name, c.is_credit_customer
     FROM restaurant_orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.id = $1`,
    [orderId],
  );
  const order = rows[0];
  if (!order) throw new Error("Order not found");
  if (order.status !== "open" && order.status !== "served") throw new Error("Order is already settled");

  return {
    id: order.id,
    orderNumber: order.order_number,
    total: Number(order.total),
    customerId: order.customer_id,
    customerName: order.customer_name,
    isCreditCustomer: order.is_credit_customer ?? false,
  };
}

export async function completeRestaurantOrder(
  orderId: string,
  payments: PaymentInput[],
  options?: {
    manualDiscount?: ManualDiscountInput | null;
    couponCode?: string | null;
  },
): Promise<SaleResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "sales.create")) {
    throw new Error("You do not have permission to take payments");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: orderRows } = await client.query<{
      id: string;
      status: string;
      subtotal: string;
      product_discount_amount: string;
      promotion_discount_amount: string;
      tax_total: string;
      total: string;
      customer_id: string | null;
    }>(`SELECT * FROM restaurant_orders WHERE id = $1 FOR UPDATE`, [orderId]);
    const order = orderRows[0];
    if (!order) throw new Error("Order not found");
    if (order.status !== "open" && order.status !== "served") {
      throw new Error("Order is already settled");
    }

    const shiftId = await requireOpenShift(user.id);

    const creditAmount = payments.filter((p) => p.method === "credit").reduce((sum, p) => sum + p.amount, 0);
    if (creditAmount > 0 && !order.customer_id) {
      throw new Error("This order has no credit customer selected");
    }
    if (creditAmount > 0 && order.customer_id) {
      const { rows: custRows } = await client.query<{
        is_credit_customer: boolean;
        credit_limit: string | null;
      }>(`SELECT is_credit_customer, credit_limit FROM customers WHERE id = $1 FOR UPDATE`, [order.customer_id]);
      const customer = custRows[0];
      if (!customer || !customer.is_credit_customer) {
        throw new Error("This customer cannot make credit purchases");
      }
      if (customer.credit_limit != null) {
        const { rows: balRows } = await client.query<{ outstanding: string }>(
          `SELECT
             COALESCE((SELECT SUM(sp.amount) FROM sales s JOIN sale_payments sp ON sp.sale_id = s.id
                       WHERE s.customer_id = $1 AND sp.method = 'credit'), 0)
             - COALESCE((SELECT SUM(amount) FROM credit_payments WHERE customer_id = $1), 0) AS outstanding`,
          [order.customer_id],
        );
        const outstanding = Number(balRows[0].outstanding);
        if (outstanding + creditAmount > Number(customer.credit_limit)) {
          throw new Error(
            `This sale would exceed the customer's credit limit (outstanding ${outstanding.toFixed(2)}, limit ${Number(customer.credit_limit).toFixed(2)})`,
          );
        }
      }
    }

    const preManualTotal = Number(order.total);

    let manualDiscountAmount = 0;
    let manualDiscountType: "percentage" | "flat" | null = null;
    let manualDiscountValue: number | null = null;
    let manualDiscountApprovedBy: string | null = null;

    if (options?.manualDiscount) {
      const { type, value, approvalToken } = options.manualDiscount;
      if (value <= 0) throw new Error("Manual discount must be greater than zero");

      const effectivePercent = type === "percentage" ? value : (value / preManualTotal) * 100;

      if (effectivePercent > MANUAL_DISCOUNT_LIMIT_PERCENT && !hasPermission(user, "discounts.override_limit")) {
        const approval = approvalToken ? await verifyApprovalToken(approvalToken, "discounts.override_limit") : null;
        if (!approval) throw new Error("Supervisor approval is required for this discount");
        manualDiscountApprovedBy = approval.approverId;
      }

      const raw = type === "percentage" ? preManualTotal * (value / 100) : value;
      manualDiscountAmount = Math.round(Math.min(raw, preManualTotal) * 100) / 100;
      manualDiscountType = type;
      manualDiscountValue = value;
    }

    const afterManual = Math.round((preManualTotal - manualDiscountAmount) * 100) / 100;

    let couponDiscountAmount = 0;
    let couponId: string | null = null;

    if (options?.couponCode) {
      const { rows: couponRows } = await client.query<{
        id: string;
        discount_type: "percentage" | "flat";
        value: string;
        min_purchase_amount: string;
        usage_limit: number | null;
        times_used: number;
        valid_from: string | null;
        valid_until: string | null;
        is_active: boolean;
      }>(`SELECT * FROM coupons WHERE upper(code) = upper($1) FOR UPDATE`, [options.couponCode.trim()]);
      const coupon = couponRows[0];
      if (!coupon) throw new Error("Coupon not found");

      const validation = validateCoupon(
        {
          discountType: coupon.discount_type,
          value: Number(coupon.value),
          minPurchaseAmount: Number(coupon.min_purchase_amount),
          usageLimit: coupon.usage_limit,
          timesUsed: coupon.times_used,
          validFrom: coupon.valid_from,
          validUntil: coupon.valid_until,
          isActive: coupon.is_active,
        },
        afterManual,
        new Date(),
      );
      if (!validation.valid) throw new Error(validation.error);

      couponDiscountAmount = validation.discountAmount;
      couponId = coupon.id;
    }

    const total = Math.round((afterManual - couponDiscountAmount) * 100) / 100;

    const paidTotal = Math.round(payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
    if (paidTotal < total) throw new Error("Payment total is less than the amount due");

    const nonCashTotal = payments.filter((p) => p.method !== "cash").reduce((sum, p) => sum + p.amount, 0);
    const cashTendered = payments.filter((p) => p.method === "cash").reduce((sum, p) => sum + p.amount, 0);
    const cashOwed = Math.max(0, Math.round((total - nonCashTotal) * 100) / 100);
    const cashApplied = Math.min(cashTendered, cashOwed);
    const changeGiven = Math.round((cashTendered - cashApplied) * 100) / 100;

    const cappedPayments = payments
      .filter((p) => p.method !== "cash")
      .concat(cashApplied > 0 ? [{ method: "cash" as const, amount: cashApplied }] : []);

    const { rows: numberRows } = await client.query<{ nextval: string }>("SELECT nextval('sale_number_seq')");
    const saleNumber = `S-${numberRows[0].nextval.padStart(6, "0")}`;

    const { rows: saleRows } = await client.query<{ id: string }>(
      `INSERT INTO sales
        (sale_number, cashier_id, customer_id, shift_id, subtotal, discount_total, tax_total, total, change_given,
         manual_discount_type, manual_discount_value, manual_discount_amount, manual_discount_approved_by,
         coupon_id, coupon_discount_amount, promotion_discount_amount, product_discount_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
      [
        saleNumber,
        user.id,
        order.customer_id,
        shiftId,
        Number(order.subtotal),
        Number(order.product_discount_amount) + Number(order.promotion_discount_amount) + manualDiscountAmount + couponDiscountAmount,
        Number(order.tax_total),
        total,
        changeGiven,
        manualDiscountType,
        manualDiscountValue,
        manualDiscountAmount,
        manualDiscountApprovedBy,
        couponId,
        couponDiscountAmount,
        Number(order.promotion_discount_amount),
        Number(order.product_discount_amount),
      ],
    );
    const saleId = saleRows[0].id;

    const { rows: orderItems } = await client.query<{
      id: string;
      product_id: string;
      product_name: string;
      quantity: string;
      unit_code: string;
      unit_price: string;
      line_subtotal: string;
      line_discount: string;
      line_tax: string;
      line_total: string;
      promotion_id: string | null;
    }>(`SELECT * FROM restaurant_order_items WHERE order_id = $1 ORDER BY created_at`, [orderId]);

    for (const item of orderItems) {
      const { rows: itemRows } = await client.query<{ id: string }>(
        `INSERT INTO sale_items
          (sale_id, product_id, product_name, quantity, unit_code, unit_price, line_subtotal, line_discount, line_tax, line_total, promotion_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [
          saleId,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit_code,
          item.unit_price,
          item.line_subtotal,
          item.line_discount,
          item.line_tax,
          item.line_total,
          item.promotion_id,
        ],
      );
      const saleItemId = itemRows[0].id;

      const { rows: batchRows } = await client.query<{ batch_id: string; quantity: string; cost_price: string }>(
        `SELECT batch_id, quantity, cost_price FROM restaurant_order_item_batches WHERE order_item_id = $1`,
        [item.id],
      );
      for (const batch of batchRows) {
        await client.query(
          `INSERT INTO sale_item_batches (sale_item_id, batch_id, quantity, cost_price) VALUES ($1,$2,$3,$4)`,
          [saleItemId, batch.batch_id, batch.quantity, batch.cost_price],
        );
      }
    }

    for (const payment of cappedPayments) {
      if (payment.amount <= 0) continue;
      await client.query(`INSERT INTO sale_payments (sale_id, method, amount) VALUES ($1, $2, $3)`, [
        saleId,
        payment.method,
        payment.amount,
      ]);
    }

    if (couponId) {
      await client.query(`UPDATE coupons SET times_used = times_used + 1 WHERE id = $1`, [couponId]);
      await client.query(
        `INSERT INTO coupon_redemptions (coupon_id, sale_id, discount_amount) VALUES ($1, $2, $3)`,
        [couponId, saleId, couponDiscountAmount],
      );
    }

    await client.query(
      `UPDATE restaurant_orders SET status = 'completed', sale_id = $1, completed_at = now() WHERE id = $2`,
      [saleId, orderId],
    );

    await client.query("COMMIT");
    return { id: saleId, saleNumber, total };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
