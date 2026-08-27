import crypto from "node:crypto";

// Crockford base32 — no I, L, O, U to avoid transcription errors.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function group(len: number): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/**
 * e.g.  PST-4F9K2-QW7XA-M3N8P-ZR6TB   (pos-standard)
 *       PSD-...                        (pos-dualscreen)
 * ~90 bits of entropy in the body.
 */
export function generateLicenseKey(product: "pos-standard" | "pos-dualscreen"): string {
  const prefix = product === "pos-dualscreen" ? "PSD" : "PST";
  return `${prefix}-${group(5)}-${group(5)}-${group(5)}-${group(5)}`;
}
