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
  expiresAt: number; // unix seconds
}

/**
 * Build + sign a fresh entitlement token. Expiry is the sooner of
 * (now + LICENSE_TOKEN_TTL_DAYS) and the license's own expiry.
 */
export function buildToken(license: License, activation: Activation) {
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = env.tokenTtlDays * 86_400;
  let expiresAt = now + ttlSeconds;

  if (license.expiresAt) {
    const licenseExp = Math.floor(license.expiresAt.getTime() / 1000);
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
  };

  return { token: signEntitlement(payload), expiresAt, payload };
}
