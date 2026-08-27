import { and, eq, notInArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { activations, licenses, terminalRegistrations } from "@/db/schema";
import { buildToken } from "@/lib/entitlement";
import { clientIp, json, logEvent } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/heartbeat
 * body: {
 *   key, fingerprint,                 // required
 *   activeTerminals?: number,          // seats in use, counted by the Server
 *   terminals?: [{ machineId, hostname?, lastSeen? }],   // optional telemetry
 *   appVersion?, hostname?
 * }
 * -> { valid, token, expiresAt, seatLimit, warning?, license }
 *
 * The desktop app calls this on a schedule (every 12-24h). A non-2xx / valid:false
 * response tells the Server to stop serving the app to ALL screens.
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
  if (!key || !fingerprint) return json({ error: "missing_fields", valid: false }, 400);
  const ip = clientIp(req);

  const license = await db.query.licenses.findFirst({ where: eq(licenses.key, key) });
  if (!license) return json({ error: "invalid_key", valid: false }, 404);

  const activation = await db.query.activations.findFirst({
    where: and(eq(activations.licenseId, license.id), eq(activations.fingerprint, fingerprint)),
  });
  if (!activation) return json({ error: "not_activated", valid: false }, 404);

  const invalidReason =
    license.status !== "active"
      ? license.status
      : activation.revoked || activation.blocked
        ? "activation_revoked"
        : license.expiresAt && license.expiresAt.getTime() < Date.now()
          ? "expired"
          : null;

  if (invalidReason) {
    await logEvent({
      licenseId: license.id,
      type: "heartbeat",
      fingerprint,
      ip,
      detail: { valid: false, reason: invalidReason },
    });
    return json({ valid: false, error: invalidReason, token: null }, 403);
  }

  const activeTerminals = Math.max(0, Math.trunc(Number(body.activeTerminals ?? 0)) || 0);

  await db
    .update(activations)
    .set({
      lastHeartbeatAt: new Date(),
      activeTerminals,
      appVersion: (body.appVersion as string) ?? activation.appVersion,
      hostname: (body.hostname as string) ?? activation.hostname,
      ipLast: ip,
    })
    .where(eq(activations.id, activation.id));

  // --- optional per-terminal telemetry --------------------------------
  const terminals = Array.isArray(body.terminals)
    ? (body.terminals as Array<{ machineId?: unknown; hostname?: unknown; lastSeen?: unknown }>)
    : [];

  if (terminals.length) {
    const keepIds: string[] = [];
    for (const t of terminals) {
      const machineId = String(t.machineId ?? "").trim();
      if (!machineId) continue;
      keepIds.push(machineId);
      const seenAt = t.lastSeen ? new Date(t.lastSeen as string | number) : new Date();
      await db
        .insert(terminalRegistrations)
        .values({
          licenseId: license.id,
          activationId: activation.id,
          machineId,
          hostname: (t.hostname as string) ?? null,
          lastSeenAt: seenAt,
        })
        .onConflictDoUpdate({
          target: [terminalRegistrations.activationId, terminalRegistrations.machineId],
          set: { lastSeenAt: seenAt, hostname: (t.hostname as string) ?? null },
        });
    }
    if (keepIds.length) {
      await db
        .delete(terminalRegistrations)
        .where(
          and(
            eq(terminalRegistrations.activationId, activation.id),
            notInArray(terminalRegistrations.machineId, keepIds),
          ),
        );
    }
  }

  const refreshed = await db.query.activations.findFirst({
    where: eq(activations.id, activation.id),
  });
  const { token, expiresAt } = buildToken(license, refreshed!);

  const overLimit = activeTerminals > license.seatLimit;
  await logEvent({
    licenseId: license.id,
    type: "heartbeat",
    fingerprint,
    ip,
    detail: { valid: true, activeTerminals, overLimit },
  });

  return json({
    valid: true,
    token,
    expiresAt,
    seatLimit: license.seatLimit,
    warning: overLimit ? "seat_limit_exceeded" : undefined,
    license: {
      product: license.product,
      edition: license.edition,
      seatLimit: license.seatLimit,
      status: license.status,
      expiresAt: license.expiresAt,
    },
  });
}
