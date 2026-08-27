import type { NextRequest } from "next/server";
import { db } from "@/db";
import { events } from "@/db/schema";
import { env } from "./env";
import { timingSafeEqualStr } from "./crypto";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Bearer-token guard for the admin REST API. */
export function checkAdminBearer(req: Request): boolean {
  if (!env.adminApiToken) return false;
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  return !!m && timingSafeEqualStr(m[1]!, env.adminApiToken);
}

export async function logEvent(e: {
  licenseId?: string | null;
  type: string;
  fingerprint?: string | null;
  ip?: string | null;
  detail?: Record<string, unknown>;
}) {
  try {
    await db.insert(events).values({
      licenseId: e.licenseId ?? null,
      type: e.type,
      fingerprint: e.fingerprint ?? null,
      ip: e.ip ?? null,
      detail: e.detail ?? null,
    });
  } catch {
    // best-effort audit logging; never fail the request over it
  }
}
