"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activations, licenses } from "@/db/schema";
import { generateLicenseKey } from "@/lib/keygen";

export async function createLicense(formData: FormData) {
  const product =
    String(formData.get("product")) === "pos-dualscreen" ? "pos-dualscreen" : "pos-standard";
  const seatLimit =
    product === "pos-dualscreen" ? Math.max(1, Number(formData.get("seatLimit") || 3)) : 1;
  const expiresRaw = String(formData.get("expiresAt") || "").trim();

  await db.insert(licenses).values({
    key: generateLicenseKey(product),
    product,
    edition: String(formData.get("edition") || "standard"),
    seatLimit,
    maxActivations: Math.max(1, Number(formData.get("maxActivations") || 1)),
    customerName: String(formData.get("customerName") || "") || null,
    customerEmail: String(formData.get("customerEmail") || "") || null,
    expiresAt: expiresRaw ? new Date(expiresRaw) : null,
    notes: String(formData.get("notes") || "") || null,
  });

  revalidatePath("/admin");
}

export async function setStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["active", "suspended", "revoked"].includes(status)) return;

  await db
    .update(licenses)
    .set({ status: status as "active" | "suspended" | "revoked", updatedAt: new Date() })
    .where(eq(licenses.id, id));

  revalidatePath("/admin");
}

/** Grant one more activation slot (after the customer legitimately replaced a PC / paid). */
export async function grantActivation(formData: FormData) {
  const id = String(formData.get("id"));
  const lic = await db.query.licenses.findFirst({ where: eq(licenses.id, id) });
  if (!lic) return;
  await db
    .update(licenses)
    .set({ maxActivations: lic.maxActivations + 1, updatedAt: new Date() })
    .where(eq(licenses.id, id));
  revalidatePath("/admin");
}

export async function toggleActivationLock(formData: FormData) {
  const id = String(formData.get("id"));
  const lic = await db.query.licenses.findFirst({ where: eq(licenses.id, id) });
  if (!lic) return;
  await db
    .update(licenses)
    .set({ activationLocked: !lic.activationLocked, updatedAt: new Date() })
    .where(eq(licenses.id, id));
  revalidatePath("/admin");
}

/** Block (keep counting) or unblock a machine row. */
export async function setMachineBlocked(formData: FormData) {
  const licenseId = String(formData.get("licenseId"));
  const machineId = String(formData.get("machineId"));
  const blocked = String(formData.get("blocked")) === "true";
  await db
    .update(activations)
    .set({ blocked })
    .where(and(eq(activations.id, machineId), eq(activations.licenseId, licenseId)));
  revalidatePath("/admin");
}

/** Delete a machine row — the deliberate "that old PC is really gone", frees a slot. */
export async function deleteMachine(formData: FormData) {
  const licenseId = String(formData.get("licenseId"));
  const machineId = String(formData.get("machineId"));
  await db
    .delete(activations)
    .where(and(eq(activations.id, machineId), eq(activations.licenseId, licenseId)));
  revalidatePath("/admin");
}
