"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activations, licenses } from "@/db/schema";
import { generateLicenseKey } from "@/lib/keygen";

export async function createLicense(formData: FormData) {
  const product =
    String(formData.get("product")) === "pos-dualscreen" ? "pos-dualscreen" : "pos-standard";
  const seatLimit =
    product === "pos-dualscreen"
      ? Math.max(1, Number(formData.get("seatLimit") || 3))
      : 1;
  const expiresRaw = String(formData.get("expiresAt") || "").trim();

  await db.insert(licenses).values({
    key: generateLicenseKey(product),
    product,
    edition: String(formData.get("edition") || "standard"),
    seatLimit,
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

export async function releaseBind(formData: FormData) {
  const id = String(formData.get("id"));
  await db
    .update(licenses)
    .set({ boundFingerprint: null, boundAt: null, updatedAt: new Date() })
    .where(eq(licenses.id, id));
  await db.delete(activations).where(eq(activations.licenseId, id));
  revalidatePath("/admin");
}
