"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { verifyApprovalToken } from "@/lib/auth/session";
import { totalFromCounts } from "@/lib/denominations";

async function requireShiftPermission() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "shifts.open_close")) {
    throw new Error("You do not have permission to manage shifts");
  }
  return user;
}

export interface CurrentShift {
  id: string;
  openedAt: string;
  openingCash: number;
}

export async function getCurrentShift(): Promise<CurrentShift | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { rows } = await pool.query<{ id: string; opened_at: string; opening_cash: string }>(
    `SELECT id, opened_at, opening_cash FROM shifts WHERE cashier_id = $1 AND status = 'open'`,
    [user.id],
  );
  const shift = rows[0];
  if (!shift) return null;
  return { id: shift.id, openedAt: shift.opened_at, openingCash: Number(shift.opening_cash) };
}

export async function openShift(denominationCounts: Record<string, number>): Promise<{ id: string }> {
  const user = await requireShiftPermission();

  const existing = await pool.query(`SELECT id FROM shifts WHERE cashier_id = $1 AND status = 'open'`, [
    user.id,
  ]);
  if (existing.rows.length > 0) {
    throw new Error("You already have an open shift");
  }

  const openingCash = totalFromCounts(denominationCounts);

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO shifts (cashier_id, opening_cash, opening_denominations)
     VALUES ($1, $2, $3) RETURNING id`,
    [user.id, openingCash, JSON.stringify(denominationCounts)],
  );

  revalidatePath("/");
  return { id: rows[0].id };
}

export interface CloseShiftResult {
  shiftId: string;
  expectedCash: number;
  countedCash: number;
  variance: number;
}

const VARIANCE_APPROVAL_THRESHOLD = 1;

export async function closeShift(
  denominationCounts: Record<string, number>,
  approvalToken?: string | null,
): Promise<CloseShiftResult> {
  const user = await requireShiftPermission();

  const { rows: shiftRows } = await pool.query<{ id: string; opening_cash: string }>(
    `SELECT id, opening_cash FROM shifts WHERE cashier_id = $1 AND status = 'open'`,
    [user.id],
  );
  const shift = shiftRows[0];
  if (!shift) throw new Error("No open shift found");

  const { rows: cashRows } = await pool.query<{ cash_total: string }>(
    `SELECT COALESCE(SUM(sp.amount), 0) AS cash_total
     FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id
     WHERE s.shift_id = $1 AND sp.method = 'cash'`,
    [shift.id],
  );

  const expectedCash =
    Math.round((Number(shift.opening_cash) + Number(cashRows[0].cash_total)) * 100) / 100;
  const countedCash = totalFromCounts(denominationCounts);
  const variance = Math.round((countedCash - expectedCash) * 100) / 100;

  if (Math.abs(variance) > VARIANCE_APPROVAL_THRESHOLD && !hasPermission(user, "shifts.override_cash")) {
    const approval = approvalToken
      ? await verifyApprovalToken(approvalToken, "shifts.override_cash")
      : null;
    if (!approval) {
      throw new Error("Supervisor approval is required to close with this cash variance");
    }
  }

  await pool.query(
    `UPDATE shifts SET status = 'closed', closed_at = now(), closing_cash = $1,
       closing_denominations = $2, expected_cash = $3, cash_variance = $4
     WHERE id = $5`,
    [countedCash, JSON.stringify(denominationCounts), expectedCash, variance, shift.id],
  );

  revalidatePath("/");
  return { shiftId: shift.id, expectedCash, countedCash, variance };
}
