// Pure discount/promotion/coupon math — safe to import from client or server code.

// Manual discounts above this percentage require supervisor approval unless the
// cashier already holds discounts.override_limit. Will move to Settings in a later phase.
export const MANUAL_DISCOUNT_LIMIT_PERCENT = 20;

export interface PromotionRule {
  id: string;
  name: string;
  type: "percentage_off" | "flat_off" | "buy_x_get_y" | "bundle";
  targetType: "product" | "category";
  targetId: string;
  value: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  getDiscountPercent: number | null;
  bundleQuantity: number | null;
  bundlePrice: number | null;
  startAt: string | null;
  endAt: string | null;
  recurringDaysOfWeek: number[] | null;
}

export function isPromotionActive(promo: PromotionRule, now: Date): boolean {
  if (promo.startAt && now < new Date(promo.startAt)) return false;
  if (promo.endAt && now > new Date(promo.endAt)) return false;
  if (promo.recurringDaysOfWeek && promo.recurringDaysOfWeek.length > 0) {
    if (!promo.recurringDaysOfWeek.includes(now.getDay())) return false;
  }
  return true;
}

export interface PromoLine {
  productId: string;
  categoryId: string | null;
  quantity: number;
  unitPrice: number;
}

export interface PromotionMatch {
  promotionId: string;
  promotionName: string;
  discountAmount: number;
}

export function bestPromotionForLine(
  line: PromoLine,
  promotions: PromotionRule[],
  now: Date,
): PromotionMatch | null {
  const matching = promotions.filter(
    (p) =>
      isPromotionActive(p, now) &&
      ((p.targetType === "product" && p.targetId === line.productId) ||
        (p.targetType === "category" && p.targetId === line.categoryId)),
  );

  let best: PromotionMatch | null = null;

  for (const promo of matching) {
    const lineTotal = line.unitPrice * line.quantity;
    let discount = 0;

    if (promo.type === "percentage_off" && promo.value) {
      discount = lineTotal * (promo.value / 100);
    } else if (promo.type === "flat_off" && promo.value) {
      discount = Math.min(promo.value, lineTotal);
    } else if (promo.type === "buy_x_get_y" && promo.buyQuantity && promo.getQuantity) {
      const groupSize = promo.buyQuantity + promo.getQuantity;
      const groups = Math.floor(line.quantity / groupSize);
      const freeUnits = groups * promo.getQuantity;
      discount = freeUnits * line.unitPrice * ((promo.getDiscountPercent ?? 100) / 100);
    } else if (promo.type === "bundle" && promo.bundleQuantity && promo.bundlePrice != null) {
      const groups = Math.floor(line.quantity / promo.bundleQuantity);
      const normalPrice = groups * promo.bundleQuantity * line.unitPrice;
      const bundlePriceTotal = groups * promo.bundlePrice;
      discount = Math.max(0, normalPrice - bundlePriceTotal);
    }

    discount = Math.round(discount * 100) / 100;
    if (discount > (best?.discountAmount ?? -1)) {
      best = { promotionId: promo.id, promotionName: promo.name, discountAmount: discount };
    }
  }

  return best;
}

export interface CouponRecord {
  discountType: "percentage" | "flat";
  value: number;
  minPurchaseAmount: number;
  usageLimit: number | null;
  timesUsed: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}

export type CouponValidation =
  | { valid: true; discountAmount: number }
  | { valid: false; error: string };

export function validateCoupon(
  coupon: CouponRecord,
  subtotalAfterOtherDiscounts: number,
  now: Date,
): CouponValidation {
  if (!coupon.isActive) return { valid: false, error: "Coupon is not active" };
  if (coupon.validFrom && now < new Date(coupon.validFrom)) {
    return { valid: false, error: "Coupon is not yet valid" };
  }
  if (coupon.validUntil && now > new Date(coupon.validUntil)) {
    return { valid: false, error: "Coupon has expired" };
  }
  if (coupon.usageLimit != null && coupon.timesUsed >= coupon.usageLimit) {
    return { valid: false, error: "Coupon usage limit reached" };
  }
  if (subtotalAfterOtherDiscounts < coupon.minPurchaseAmount) {
    return {
      valid: false,
      error: `Minimum purchase of ${coupon.minPurchaseAmount.toFixed(2)} required`,
    };
  }

  const raw =
    coupon.discountType === "percentage"
      ? subtotalAfterOtherDiscounts * (coupon.value / 100)
      : Math.min(coupon.value, subtotalAfterOtherDiscounts);

  return { valid: true, discountAmount: Math.round(raw * 100) / 100 };
}

export function productDiscountAmount(
  discountType: "percentage" | "flat" | null,
  discountValue: number | null,
  lineTotal: number,
): number {
  if (!discountType || !discountValue) return 0;
  const raw = discountType === "percentage" ? lineTotal * (discountValue / 100) : discountValue;
  return Math.round(Math.min(raw, lineTotal) * 100) / 100;
}
