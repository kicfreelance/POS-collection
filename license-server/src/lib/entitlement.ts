import { signEntitlement } from "./crypto";
import { env } from "./env";
import type { Activation, License } from "@/db/schema";

export interface EntitlementPayload {
  v: 1;
  licenseId: string;
  product: License["product"];
  edition: string;
  seatLimit: number;
  fingerprint: string;
  role: Activation["role"];
  status: License["status"];
  tokenVersion: number;
  issuedAt: number; // unix seconds
  expiresAt: number; // unix seconds (sentinel far-future when perpetual)
  perpetual: boolean; // true => client ignores expiresAt entirely
}

// ~100 years — a stand-in "expiry" so the token format stays uniform for
// perpetual licences. The client ignores it when `perpetual` is true.
const PERPETUAL_SENTINEL = () => Math.floor(Date.now() / 1000) + 100 * 365 * 86_400;

/**
 * Build + sign a fresh entitlement token.
 *
 * - Perpetual licence (license.expiresAt === null): `perpetual: true`, expiry set
 *   to a far-future sentinel. Works offline forever.
 * - Time-limited licence: expiry = the sooner of (now + LICENSE_TOKEN_TTL_DAYS)
 *   and the licence's own end date; the client enforces it (+ offline grace).
 */
export function buildToken(license: License, activation: Activation) {
  const now = Math.floor(Date.now() / 1000);
  const perpetual = license.expiresAt === null;

  let expiresAt: number;
  if (perpetual) {
    expiresAt = PERPETUAL_SENTINEL();
  } else {
    expiresAt = now + env.tokenTtlDays * 86_400;
    const licenseExp = Math.floor(license.expiresAt!.getTime() / 1000);
    if (licenseExp < expiresAt) expiresAt = licenseExp;
  }

  const payload: EntitlementPayload = {
    v: 1,
    licenseId: license.id,
    product: license.product,
    edition: license.edition,
    seatLimit: license.seatLimit,
    fingerprint: activation.fingerprint,
    role: activation.role,
    status: license.status,
    tokenVersion: activation.tokenVersion,
    issuedAt: now,
    expiresAt,
    perpetual,
  };

  return { token: signEntitlement(payload), expiresAt, payload };
}
