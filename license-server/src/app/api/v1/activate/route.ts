import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { activations, licenses } from "@/db/schema";
import { buildToken } from "@/lib/entitlement";
import { clientIp, json, logEvent } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/activate
 * body: {
 *   key, fingerprint,          // required
 *   role?: "standalone" | "server",
 *   product?, hostname?, appVersion?, os?,
 *   transfer?: boolean          // opt-in takeover from a different machine
 * }
 * -> { token, expiresAt, license: {...} }
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

  const role = body.role === "server" ? "server" : "standalone";
  const ip = clientIp(req);

  const license = await db.query.licenses.findFirst({ where: eq(licenses.key, key) });
  if (!license) {
    await logEvent({ type: "reject", fingerprint, ip, detail: { reason: "invalid_key" } });
    return json({ error: "invalid_key" }, 404);
  }

  if (license.status !== "active") {
    await logEvent({
      licenseId: license.id,
      type: "reject",
      fingerprint,
      ip,
      detail: { reason: license.status },
    });
    return json({ error: license.status }, 403);
  }

  if (license.expiresAt && license.expiresAt.getTime() < Date.now()) {
    await logEvent({ licenseId: license.id, type: "reject", fingerprint, ip, detail: { reason: "expired" } });
    return json({ error: "expired", expiresAt: license.expiresAt }, 403);
  }

  if (body.product && body.product !== license.product) {
    await logEvent({
      licenseId: license.id,
      type: "reject",
      fingerprint,
      ip,
      detail: { reason: "product_mismatch", got: body.product },
    });
    return json({ error: "product_mismatch", expected: license.product }, 403);
  }

  // --- binding -------------------------------------------------------------
  if (!license.boundFingerprint) {
    await db
      .update(licenses)
      .set({
        boundFingerprint: fingerprint,
        boundAt: new Date(),
        activationCount: license.activationCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(licenses.id, license.id));
  } else if (license.boundFingerprint !== fingerprint) {
    const transfersLeft = license.maxTransfers - license.transfersUsed;
    if (body.transfer !== true) {
      await logEvent({
        licenseId: license.id,
        type: "reject",
        fingerprint,
        ip,
        detail: { reason: "already_activated_elsewhere" },
      });
      return json(
        { error: "already_activated_elsewhere", boundAt: license.boundAt, transfersLeft },
        409,
      );
    }
    if (transfersLeft <= 0) {
      await logEvent({
        licenseId: license.id,
        type: "reject",
        fingerprint,
        ip,
        detail: { reason: "transfer_limit_reached" },
      });
      return json({ error: "transfer_limit_reached" }, 409);
    }
    // Take over: drop the previous machine's activation(s).
    await db.delete(activations).where(eq(activations.licenseId, license.id));
    await db
      .update(licenses)
      .set({
        boundFingerprint: fingerprint,
        boundAt: new Date(),
        transfersUsed: license.transfersUsed + 1,
        activationCount: license.activationCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(licenses.id, license.id));
    await logEvent({ licenseId: license.id, type: "transfer", fingerprint, ip });
  }

  // --- upsert the activation row ----------------------------------------
  const existing = await db.query.activations.findFirst({
    where: and(eq(activations.licenseId, license.id), eq(activations.fingerprint, fingerprint)),
  });

  let activation;
  if (existing) {
    [activation] = await db
      .update(activations)
      .set({
        hostname: (body.hostname as string) ?? existing.hostname,
        role,
        appVersion: (body.appVersion as string) ?? existing.appVersion,
        os: (body.os as string) ?? existing.os,
        revoked: false,
        lastHeartbeatAt: new Date(),
      })
      .where(eq(activations.id, existing.id))
      .returning();
  } else {
    [activation] = await db
      .insert(activations)
      .values({
        licenseId: license.id,
        fingerprint,
        hostname: (body.hostname as string) ?? null,
        role,
        appVersion: (body.appVersion as string) ?? null,
        os: (body.os as string) ?? null,
        lastHeartbeatAt: new Date(),
      })
      .returning();
  }

  const fresh = await db.query.licenses.findFirst({ where: eq(licenses.id, license.id) });
  const { token, expiresAt } = buildToken(fresh!, activation!);
  await logEvent({ licenseId: license.id, type: "activate", fingerprint, ip, detail: { role } });

  return json({
    token,
    expiresAt,
    license: {
      product: fresh!.product,
      edition: fresh!.edition,
      seatLimit: fresh!.seatLimit,
      status: fresh!.status,
      expiresAt: fresh!.expiresAt,
    },
  });
}
