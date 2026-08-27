import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { activations, licenses } from "@/db/schema";
import { checkAdminBearer, json, logEvent } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/licenses/:id
 * body may contain: status, seatLimit, expiresAt, maxTransfers, notes,
 *   customerName, customerEmail, releaseBind (true -> clear the machine binding)
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!checkAdminBearer(req)) return json({ error: "unauthorized" }, 401);
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.status === "string" && ["active", "suspended", "revoked"].includes(body.status)) {
    patch.status = body.status;
  }
  if (body.seatLimit != null) patch.seatLimit = Math.max(1, Math.trunc(Number(body.seatLimit)) || 1);
  if (body.expiresAt !== undefined) {
    patch.expiresAt = body.expiresAt ? new Date(body.expiresAt as string) : null;
  }
  if (body.maxTransfers != null) patch.maxTransfers = Math.trunc(Number(body.maxTransfers)) || 0;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.customerName !== undefined) patch.customerName = body.customerName;
  if (body.customerEmail !== undefined) patch.customerEmail = body.customerEmail;
  if (body.releaseBind === true) {
    patch.boundFingerprint = null;
    patch.boundAt = null;
  }

  const [row] = await db.update(licenses).set(patch).where(eq(licenses.id, id)).returning();
  if (!row) return json({ error: "not_found" }, 404);

  // Force cached tokens to be re-issued at the next heartbeat.
  await db
    .update(activations)
    .set({ tokenVersion: 1 })
    .where(eq(activations.licenseId, id));

  await logEvent({ licenseId: id, type: "admin", detail: { action: "patch", patch: Object.keys(patch) } });
  return json({ license: row });
}

/** DELETE /api/v1/licenses/:id */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!checkAdminBearer(req)) return json({ error: "unauthorized" }, 401);
  const { id } = await params;
  const [row] = await db.delete(licenses).where(eq(licenses.id, id)).returning();
  if (!row) return json({ error: "not_found" }, 404);
  return json({ ok: true });
}
