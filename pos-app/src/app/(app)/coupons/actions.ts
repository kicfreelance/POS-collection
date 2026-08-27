"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";

async function requireCouponsManage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "coupons.manage")) {
    throw new Error("You do not have permission to manage coupons");
  }
  return user;
}

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(pattern: string): string {
  return pattern.replace(/X/g, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]);
}

export interface CouponBatchInput {
  pattern: string;
  quantity: number;
  discountType: "percentage" | "flat";
  value: number;
  minPurchaseAmount: number;
  usageLimit: number | null;
  validFrom: string | null;
  validUntil: string | null;
  batchLabel: string;
}

export async function createCouponBatch(input: CouponBatchInput): Promise<string[]> {
  await requireCouponsManage();

  if (!input.pattern.includes("X")) {
    throw new Error("Pattern must include at least one X placeholder");
  }
  if (input.quantity < 1 || input.quantity > 5000) {
    throw new Error("Quantity must be between 1 and 5000");
  }
  if (input.value <= 0) {
    throw new Error("Discount value must be greater than zero");
  }

  const codes: string[] = [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (let i = 0; i < input.quantity; i++) {
      let inserted = false;
      for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
        const code = generateCode(input.pattern);
        try {
          await client.query(
            `INSERT INTO coupons
              (code, discount_type, value, min_purchase_amount, usage_limit, valid_from, valid_until, batch_label)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              code,
              input.discountType,
              input.value,
              input.minPurchaseAmount,
              input.usageLimit,
              input.validFrom,
              input.validUntil,
              input.batchLabel,
            ],
          );
          codes.push(code);
          inserted = true;
        } catch (err) {
          if (attempt === 4) throw err;
        }
      }
    }

    await client.query("COMMIT");
    revalidatePath("/coupons");
    return codes;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setCouponActive(couponId: string, isActive: boolean): Promise<void> {
  await requireCouponsManage();
  await pool.query(`UPDATE coupons SET is_active = $1 WHERE id = $2`, [isActive, couponId]);
  revalidatePath("/coupons");
}
