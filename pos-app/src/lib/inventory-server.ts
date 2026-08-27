import type { PoolClient } from "pg";

export interface BatchConsumption {
  batchId: string;
  quantity: number;
  costPrice: number;
}

/**
 * Deducts `baseQuantity` (already converted to the product's base unit) from
 * the product's batches oldest-received-first, and returns which batches were
 * drawn from so the sale can keep a COGS trail regardless of the costing
 * method chosen later in Settings.
 *
 * `preferBatchId`, when given, is drawn from first; any overflow then falls
 * back to FIFO across the remaining batches.
 */
export async function deductStockFifo(
  client: PoolClient,
  productId: string,
  baseQuantity: number,
  preferBatchId: string | null = null,
): Promise<BatchConsumption[]> {
  let remaining = baseQuantity;
  const consumed: BatchConsumption[] = [];

  const { rows: batches } = await client.query<{
    id: string;
    quantity_remaining: string;
    cost_price: string;
  }>(
    `SELECT id, quantity_remaining, cost_price FROM batches
     WHERE product_id = $1 AND quantity_remaining > 0
     ORDER BY (CASE WHEN $2::uuid IS NOT NULL AND id = $2::uuid THEN 0 ELSE 1 END),
              received_date ASC, created_at ASC
     FOR UPDATE`,
    [productId, preferBatchId],
  );

  for (const batch of batches) {
    if (remaining <= 0) break;
    const available = Number(batch.quantity_remaining);
    const take = Math.min(available, remaining);
    if (take <= 0) continue;

    await client.query(`UPDATE batches SET quantity_remaining = quantity_remaining - $1 WHERE id = $2`, [
      take,
      batch.id,
    ]);

    consumed.push({ batchId: batch.id, quantity: take, costPrice: Number(batch.cost_price) });
    remaining -= take;
  }

  if (remaining > 0.0001) {
    throw new Error("Not enough stock available for this sale");
  }

  return consumed;
}

export interface StockLevel {
  productId: string;
  name: string;
  sku: string;
  baseUnit: string;
  reorderThreshold: number;
  quantityOnHand: number;
}
