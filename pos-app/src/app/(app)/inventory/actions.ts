"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";

async function requireInventoryAdjust() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "inventory.adjust")) {
    throw new Error("You do not have permission to adjust stock");
  }
  return user;
}

export async function createStockAdjustment(
  productId: string,
  batchId: string,
  quantityDelta: number,
  reason: string,
): Promise<void> {
  const user = await requireInventoryAdjust();
  if (quantityDelta === 0) throw new Error("Adjustment quantity cannot be zero");
  if (!reason.trim()) throw new Error("A reason is required");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{ quantity_remaining: string }>(
      `SELECT quantity_remaining FROM batches WHERE id = $1 FOR UPDATE`,
      [batchId],
    );
    const batch = rows[0];
    if (!batch) throw new Error("Batch not found");
    const newQuantity = Number(batch.quantity_remaining) + quantityDelta;
    if (newQuantity < 0) throw new Error("Adjustment would make batch stock negative");
    await client.query(`UPDATE batches SET quantity_remaining = $1 WHERE id = $2`, [
      newQuantity,
      batchId,
    ]);

    await client.query(
      `INSERT INTO stock_adjustments (product_id, batch_id, quantity_delta, reason, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [productId, batchId, quantityDelta, reason.trim(), user.id],
    );

    await client.query("COMMIT");
    revalidatePath("/inventory");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
