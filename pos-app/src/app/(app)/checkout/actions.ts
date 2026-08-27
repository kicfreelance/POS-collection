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

export interface CartLineInput {
  productId: string;
  unitCode: string;
  quantity: number;
}

export interface PaymentInput {
  method: "cash" | "card" | "credit";
  amount: number;
}

export interface ManualDiscountInput {
  type: "percentage" | "flat";
  value: number;
  approvalToken?: string | null;
}

export interface SaleResult {
  id: string;
  saleNumber: string;
  total: number;
}

export async function checkCoupon(
  code: string,
  currentTotal: number,
): Promise<{ valid: true; discountAmount: number; couponId: string } | { valid: false; error: string }> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "sales.create")) {
    return { valid: false, error: "Not permitted" };
  }

  const { rows } = await pool.query<{
    id: string;
    discount_type: "percentage" | "flat";
    value: string;
    min_purchase_amount: string;
    usage_limit: number | null;
    times_used: number;
    valid_from: string | null;
    valid_until: string | null;
    is_active: boolean;
  }>(`SELECT * FROM coupons WHERE upper(code) = upper($1)`, [code.trim()]);

  const coupon = rows[0];
  if (!coupon) return { valid: false, error: "Coupon not found" };

  const result = validateCoupon(
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
    currentTotal,
    new Date(),
  );

  if (!result.valid) return result;
  return { valid: true, discountAmount: result.discountAmount, couponId: coupon.id };
}

export async function createSale(
  lines: CartLineInput[],
  payments: PaymentInput[],
  options?: {
    manualDiscount?: ManualDiscountInput | null;
    couponCode?: string | null;
    customerId?: string | null;
  },
): Promise<SaleResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "sales.create")) {
    throw new Error("You do not have permission to create sales");
  }
  if (lines.length === 0) {
    throw new Error("Cart is empty");
  }

  const creditAmount = payments
    .filter((p) => p.method === "credit")
    .reduce((sum, p) => sum + p.amount, 0);
  if (creditAmount > 0 && !options?.customerId) {
    throw new Error("Select a credit customer to use the credit payment method");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (creditAmount > 0 && options?.customerId) {
      const { rows: custRows } = await client.query<{
        is_credit_customer: boolean;
        credit_limit: string | null;
      }>(`SELECT is_credit_customer, credit_limit FROM customers WHERE id = $1 FOR UPDATE`, [
        options.customerId,
      ]);
      const customer = custRows[0];
      if (!customer || !customer.is_credit_customer) {
        throw new Error("Selected customer cannot make credit purchases");
      }
      if (customer.credit_limit != null) {
        const { rows: balRows } = await client.query<{ outstanding: string }>(
          `SELECT
             COALESCE((SELECT SUM(sp.amount) FROM sales s JOIN sale_payments sp ON sp.sale_id = s.id
                       WHERE s.customer_id = $1 AND sp.method = 'credit'), 0)
             - COALESCE((SELECT SUM(amount) FROM credit_payments WHERE customer_id = $1), 0) AS outstanding`,
          [options.customerId],
        );
        const outstanding = Number(balRows[0].outstanding);
        if (outstanding + creditAmount > Number(customer.credit_limit)) {
          throw new Error(
            `This sale would exceed the customer's credit limit (outstanding ${outstanding.toFixed(2)}, limit ${Number(customer.credit_limit).toFixed(2)})`,
          );
        }
      }
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
      }>(
        `SELECT id, name, category_id, base_unit, selling_price, tax_rate, discount_type, discount_value, is_active
         FROM products WHERE id = $1`,
        [line.productId],
      );
      const product = rows[0];
      if (!product || !product.is_active) {
        throw new Error("A product in the cart is no longer available");
      }
      if (line.quantity <= 0) {
        throw new Error(`Invalid quantity for ${product.name}`);
      }

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
        if (!conversion) {
          throw new Error(`Invalid unit for ${product.name}`);
        }
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
        {
          productId: product.id,
          categoryId: product.category_id,
          quantity: line.quantity,
          unitPrice,
        },
        promotions,
        now,
      );
      const promotionDiscount = Math.min(
        promoMatch?.discountAmount ?? 0,
        lineSub - productDiscount,
      );

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
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    productDiscountTotal = Math.round(productDiscountTotal * 100) / 100;
    promotionDiscountTotal = Math.round(promotionDiscountTotal * 100) / 100;
    taxTotal = Math.round(taxTotal * 100) / 100;
    const grossAfterLineDiscounts =
      Math.round((subtotal - productDiscountTotal - promotionDiscountTotal) * 100) / 100;
    const preManualTotal = settings.taxInclusivePricing
      ? grossAfterLineDiscounts
      : Math.round((grossAfterLineDiscounts + taxTotal) * 100) / 100;

    let manualDiscountAmount = 0;
    let manualDiscountType: "percentage" | "flat" | null = null;
    let manualDiscountValue: number | null = null;
    let manualDiscountApprovedBy: string | null = null;

    if (options?.manualDiscount) {
      const { type, value, approvalToken } = options.manualDiscount;
      if (value <= 0) throw new Error("Manual discount must be greater than zero");

      const effectivePercent = type === "percentage" ? value : (value / preManualTotal) * 100;

      if (effectivePercent > MANUAL_DISCOUNT_LIMIT_PERCENT && !hasPermission(user, "discounts.override_limit")) {
        const approval = approvalToken
          ? await verifyApprovalToken(approvalToken, "discounts.override_limit")
          : null;
        if (!approval) {
          throw new Error("Supervisor approval is required for this discount");
        }
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
        now,
      );
      if (!validation.valid) throw new Error(validation.error);

      couponDiscountAmount = validation.discountAmount;
      couponId = coupon.id;
    }

    const total = Math.round((afterManual - couponDiscountAmount) * 100) / 100;

    const paidTotal = Math.round(payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
    if (paidTotal < total) {
      throw new Error("Payment total is less than the sale total");
    }

    // Card/credit are exact charges and are never "overpaid." Any overpayment can only
    // come from cash, so cash is the sole source of change and is capped to what's
    // actually owed after other methods — this keeps the recorded cash payment equal to
    // its true impact on the drawer (tendered minus change), which shift reconciliation relies on.
    const nonCashTotal = payments
      .filter((p) => p.method !== "cash")
      .reduce((sum, p) => sum + p.amount, 0);
    const cashTendered = payments.filter((p) => p.method === "cash").reduce((sum, p) => sum + p.amount, 0);
    const cashOwed = Math.max(0, Math.round((total - nonCashTotal) * 100) / 100);
    const cashApplied = Math.min(cashTendered, cashOwed);
    const changeGiven = Math.round((cashTendered - cashApplied) * 100) / 100;

    const cappedPayments = payments
      .filter((p) => p.method !== "cash")
      .concat(cashApplied > 0 ? [{ method: "cash" as const, amount: cashApplied }] : []);

    const { rows: shiftRows } = await client.query<{ id: string }>(
      `SELECT id FROM shifts WHERE cashier_id = $1 AND status = 'open'`,
      [user.id],
    );
    const shift = shiftRows[0];
    if (!shift) {
      throw new Error("Open a shift before ringing up sales");
    }

    const { rows: numberRows } = await client.query<{ nextval: string }>(
      "SELECT nextval('sale_number_seq')",
    );
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
        options?.customerId ?? null,
        shift.id,
        subtotal,
        productDiscountTotal + promotionDiscountTotal + manualDiscountAmount + couponDiscountAmount,
        taxTotal,
        total,
        changeGiven,
        manualDiscountType,
        manualDiscountValue,
        manualDiscountAmount,
        manualDiscountApprovedBy,
        couponId,
        couponDiscountAmount,
        promotionDiscountTotal,
        productDiscountTotal,
      ],
    );
    const saleId = saleRows[0].id;

    for (const line of computedLines) {
      const { rows: itemRows } = await client.query<{ id: string }>(
        `INSERT INTO sale_items
          (sale_id, product_id, product_name, quantity, unit_code, unit_price, line_subtotal, line_discount, line_tax, line_total, promotion_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [
          saleId,
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
      const saleItemId = itemRows[0].id;

      const consumed = await deductStockFifo(client, line.productId, line.baseQuantity);
      for (const batch of consumed) {
        await client.query(
          `INSERT INTO sale_item_batches (sale_item_id, batch_id, quantity, cost_price) VALUES ($1,$2,$3,$4)`,
          [saleItemId, batch.batchId, batch.quantity, batch.costPrice],
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

    await client.query("COMMIT");

    return { id: saleId, saleNumber, total };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
