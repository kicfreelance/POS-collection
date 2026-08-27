"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";

async function requirePromotionsManage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "promotions.manage")) {
    throw new Error("You do not have permission to manage promotions");
  }
  return user;
}

export interface PromotionInput {
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

export async function createPromotion(input: PromotionInput): Promise<void> {
  await requirePromotionsManage();
  if (!input.name.trim()) throw new Error("Promotion name is required");
  if (!input.targetId) throw new Error("Select a product or category to target");

  await pool.query(
    `INSERT INTO promotions
      (name, type, target_type, target_id, value, buy_quantity, get_quantity, get_discount_percent,
       bundle_quantity, bundle_price, start_at, end_at, recurring_days_of_week)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      input.name.trim(),
      input.type,
      input.targetType,
      input.targetId,
      input.value,
      input.buyQuantity,
      input.getQuantity,
      input.getDiscountPercent,
      input.bundleQuantity,
      input.bundlePrice,
      input.startAt,
      input.endAt,
      input.recurringDaysOfWeek,
    ],
  );

  revalidatePath("/promotions");
}

export async function setPromotionActive(promotionId: string, isActive: boolean): Promise<void> {
  await requirePromotionsManage();
  await pool.query(`UPDATE promotions SET is_active = $1 WHERE id = $2`, [isActive, promotionId]);
  revalidatePath("/promotions");
}

export async function deletePromotion(promotionId: string): Promise<void> {
  await requirePromotionsManage();
  await pool.query(`DELETE FROM promotions WHERE id = $1`, [promotionId]);
  revalidatePath("/promotions");
}
