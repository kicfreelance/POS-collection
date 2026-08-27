import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { activations, licenses } from "@/db/schema";
import { clientIp, json, logEvent } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/deactivate
 * body: { key, fingerprint }
 *
 * Offline-forever model: this does NOT free an activation slot. A machine we
 * can't contact can't be trusted to have actually stopped, so the machine stays
 * on the ledger and keeps counting toward `maxActivations`. It only:
 *   - marks the row `revoked` (so any future online heartbeat from it fails), and
 *   - clears the informational `boundFingerprint`.
 * To genuinely free a slot, a vendor deletes the machine row in /admin.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const key = String(body.key ?? "").trim().toUpperCase();
  const fingerprint = String(body.fingerprint ?? "").trim();
  if (!key || !fingerprint) return json({ error: "missing_fields" }, 400);
  const ip = clientIp(req);

  const license = await db.query.licenses.findFirst({ where: eq(licenses.key, key) });
  if (!license) return json({ error: "invalid_key" }, 404);

  await db
    .update(activations)
    .set({ revoked: true })
    .where(and(eq(activations.licenseId, license.id), eq(activations.fingerprint, fingerprint)));

  if (license.boundFingerprint === fingerprint) {
    await db
      .update(licenses)
      .set({ boundFingerprint: null, boundAt: null, updatedAt: new Date() })
      .where(eq(licenses.id, license.id));
  }

  await logEvent({ licenseId: license.id, type: "deactivate", fingerprint, ip });
  return json({ ok: true, note: "activation slot retained; a vendor must delete the machine to free it" });
}
