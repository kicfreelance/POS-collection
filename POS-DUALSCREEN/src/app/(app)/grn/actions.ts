"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";

async function requireGrnManage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "grn.manage")) {
    throw new Error("You do not have permission to manage GRNs");
  }
  return user;
}

export interface GrnItemInput {
  productId: string;
  batchNumber: string;
  quantity: number;
  costPrice: number;
  expiryDate: string | null;
}

export interface GrnInput {
  supplierId: string;
  receivedDate: string;
  notes: string | null;
  items: GrnItemInput[];
}

export async function createGrn(input: GrnInput): Promise<{ id: string; grnNumber: string }> {
  const user = await requireGrnManage();

  if (!input.supplierId) throw new Error("Supplier is required");
  if (input.items.length === 0) throw new Error("Add at least one line item");
  for (const item of input.items) {
    if (item.quantity <= 0) throw new Error("Quantity must be greater than zero");
    if (item.costPrice < 0) throw new Error("Cost price cannot be negative");
    if (!item.batchNumber.trim()) throw new Error("Batch number is required");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: numberRows } = await client.query<{ nextval: string }>(
      "SELECT nextval('grn_number_seq')",
    );
    const grnNumber = `GRN-${numberRows[0].nextval.padStart(6, "0")}`;

    const { rows: grnRows } = await client.query<{ id: string }>(
      `INSERT INTO grns (grn_number, supplier_id, received_date, created_by, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [grnNumber, input.supplierId, input.receivedDate, user.id, input.notes],
    );
    const grnId = grnRows[0].id;

    for (const item of input.items) {
      const { rows: batchRows } = await client.query<{ id: string }>(
        `INSERT INTO batches
          (product_id, batch_number, cost_price, quantity_received, quantity_remaining, expiry_date, received_date, supplier_id)
         VALUES ($1,$2,$3,$4,$4,$5,$6,$7)
         RETURNING id`,
        [
          item.productId,
          item.batchNumber.trim(),
          item.costPrice,
          item.quantity,
          item.expiryDate,
          input.receivedDate,
          input.supplierId,
        ],
      );
      const batchId = batchRows[0].id;

      await client.query(
        `INSERT INTO grn_items (grn_id, product_id, batch_id, quantity, cost_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [grnId, item.productId, batchId, item.quantity, item.costPrice],
      );
    }

    await client.query("COMMIT");
    revalidatePath("/grn");
    revalidatePath("/inventory");
    return { id: grnId, grnNumber };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function returnBatchToSupplier(
  batchId: string,
  quantity: number,
  reason: string,
): Promise<void> {
  const user = await requireGrnManage();
  if (quantity <= 0) throw new Error("Quantity must be greater than zero");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{ quantity_remaining: string }>(
      `SELECT quantity_remaining FROM batches WHERE id = $1 FOR UPDATE`,
      [batchId],
    );
    const batch = rows[0];
    if (!batch) throw new Error("Batch not found");
    if (Number(batch.quantity_remaining) < quantity) {
      throw new Error("Cannot return more than the remaining batch quantity");
    }

    await client.query(`UPDATE batches SET quantity_remaining = quantity_remaining - $1 WHERE id = $2`, [
      quantity,
      batchId,
    ]);

    const { rows: numberRows } = await client.query<{ nextval: string }>(
      "SELECT nextval('grn_return_number_seq')",
    );
    const returnNumber = `GRNR-${numberRows[0].nextval.padStart(6, "0")}`;

    await client.query(
      `INSERT INTO grn_returns (return_number, batch_id, quantity, reason, created_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [returnNumber, batchId, quantity, reason, user.id],
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
