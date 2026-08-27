import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { activations, licenses } from "@/db/schema";
import { checkAdminBearer, json, logEvent } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/licenses/:id
 * License fields: status, seatLimit, expiresAt, maxActivations, activationLocked,
 *   notes, customerName, customerEmail, releaseBind.
 * Convenience: grantActivation (true -> maxActivations += 1).
 * Machine actions (by activation row id): blockMachine, unblockMachine,
 *   deleteMachine (the deliberate "that old PC is really gone" — frees a slot),
 *   labelMachine ({ id, label }).
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

  const license = await db.query.licenses.findFirst({ where: eq(licenses.id, id) });
  if (!license) return json({ error: "not_found" }, 404);

  // ---- machine-level actions -------------------------------------------
  const machineActions: string[] = [];
  const inThisLicense = (actId: string) =>
    and(eq(activations.id, actId), eq(activations.licenseId, id));

  if (typeof body.blockMachine === "string") {
    await db.update(activations).set({ blocked: true }).where(inThisLicense(body.blockMachine));
    machineActions.push("block");
  }
  if (typeof body.unblockMachine === "string") {
    await db.update(activations).set({ blocked: false }).where(inThisLicense(body.unblockMachine));
    machineActions.push("unblock");
  }
  if (typeof body.deleteMachine === "string") {
    await db.delete(activations).where(inThisLicense(body.deleteMachine));
    machineActions.push("delete");
  }
  if (
    body.labelMachine &&
    typeof body.labelMachine === "object" &&
    typeof (body.labelMachine as any).id === "string"
  ) {
    const { id: mId, label } = body.labelMachine as { id: string; label?: string };
    await db.update(activations).set({ label: label ?? null }).where(inThisLicense(mId));
    machineActions.push("label");
  }

  // ---- license fields -------------------------------------------------
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.status === "string" && ["active", "suspended", "revoked"].includes(body.status)) {
    patch.status = body.status;
  }
  if (body.seatLimit != null) patch.seatLimit = Math.max(1, Math.trunc(Number(body.seatLimit)) || 1);
  if (body.expiresAt !== undefined) {
    patch.expiresAt = body.expiresAt ? new Date(body.expiresAt as string) : null;
  }
  if (body.maxActivations != null) {
    patch.maxActivations = Math.max(1, Math.trunc(Number(body.maxActivations)) || 1);
  }
  if (body.grantActivation === true) {
    patch.maxActivations = license.maxActivations + 1;
  }
  if (typeof body.activationLocked === "boolean") patch.activationLocked = body.activationLocked;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.customerName !== undefined) patch.customerName = body.customerName;
  if (body.customerEmail !== undefined) patch.customerEmail = body.customerEmail;
  if (body.releaseBind === true) {
    patch.boundFingerprint = null;
    patch.boundAt = null;
  }

  const [row] = await db.update(licenses).set(patch).where(eq(licenses.id, id)).returning();

  await logEvent({
    licenseId: id,
    type: "admin",
    detail: { action: "patch", fields: Object.keys(patch), machineActions },
  });
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
