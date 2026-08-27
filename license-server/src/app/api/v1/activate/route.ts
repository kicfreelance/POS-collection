import { and, count, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { activations, licenses } from "@/db/schema";
import { buildToken } from "@/lib/entitlement";
import { clientIp, json, logEvent } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/activate
 * body: { key, fingerprint, role?, product?, hostname?, appVersion?, os? }
 * -> { token, expiresAt, license: {...} }
 *
 * Offline-forever model: an activation is permanent. Re-activating a machine
 * already on record is free; a new machine consumes one of `maxActivations`
 * slots and is refused once they run out (a human must raise the cap or delete
 * a machine row). There is no self-service transfer.
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

  const existing = await db.query.activations.findFirst({
    where: and(eq(activations.licenseId, license.id), eq(activations.fingerprint, fingerprint)),
  });

  let activation;

  if (existing) {
    // Known machine — reinstall / re-launch. Always free, even if the licence is
    // otherwise at its activation cap.
    if (existing.blocked) {
      await logEvent({
        licenseId: license.id,
        type: "reject",
        fingerprint,
        ip,
        detail: { reason: "machine_blocked" },
      });
      return json({ error: "machine_blocked" }, 403);
    }
    [activation] = await db
      .update(activations)
      .set({
        hostname: (body.hostname as string) ?? existing.hostname,
        role,
        appVersion: (body.appVersion as string) ?? existing.appVersion,
        os: (body.os as string) ?? existing.os,
        ipLast: ip,
        reactivations: existing.reactivations + 1,
        revoked: false,
        lastHeartbeatAt: new Date(),
      })
      .where(eq(activations.id, existing.id))
      .returning();
    await logEvent({ licenseId: license.id, type: "activate", fingerprint, ip, detail: { role, kind: "reinstall" } });
  } else {
    // Brand-new machine — must fit within the lifetime activation budget.
    if (license.activationLocked) {
      await logEvent({ licenseId: license.id, type: "reject", fingerprint, ip, detail: { reason: "activation_locked" } });
      return json({ error: "activation_locked" }, 403);
    }

    const [{ used }] = await db
      .select({ used: count() })
      .from(activations)
      .where(and(eq(activations.licenseId, license.id), eq(activations.blocked, false)));

    if (used >= license.maxActivations) {
      const machines = await db.query.activations.findMany({
        where: eq(activations.licenseId, license.id),
        columns: { fingerprint: true, hostname: true, createdAt: true, lastHeartbeatAt: true },
      });
      await logEvent({
        licenseId: license.id,
        type: "reject",
        fingerprint,
        ip,
        detail: { reason: "activation_limit_reached", used, max: license.maxActivations },
      });
      return json(
        {
          error: "activation_limit_reached",
          used,
          max: license.maxActivations,
          machines: machines.map((m) => ({
            id: m.fingerprint.slice(0, 12),
            hostname: m.hostname,
            firstSeen: m.createdAt,
            lastSeen: m.lastHeartbeatAt,
          })),
        },
        403,
      );
    }

    [activation] = await db
      .insert(activations)
      .values({
        licenseId: license.id,
        fingerprint,
        hostname: (body.hostname as string) ?? null,
        role,
        appVersion: (body.appVersion as string) ?? null,
        os: (body.os as string) ?? null,
        ipFirst: ip,
        ipLast: ip,
        lastHeartbeatAt: new Date(),
      })
      .returning();

    await db
      .update(licenses)
      .set({
        boundFingerprint: fingerprint,
        boundAt: new Date(),
        activationCount: license.activationCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(licenses.id, license.id));

    await logEvent({
      licenseId: license.id,
      type: "activate",
      fingerprint,
      ip,
      detail: { role, kind: "new_machine", slot: used + 1, max: license.maxActivations },
    });
  }

  const { token, expiresAt } = buildToken(license, activation!);

  return json({
    token,
    expiresAt,
    license: {
      product: license.product,
      edition: license.edition,
      seatLimit: license.seatLimit,
      status: license.status,
      expiresAt: license.expiresAt,
      perpetual: license.expiresAt === null,
    },
  });
}
