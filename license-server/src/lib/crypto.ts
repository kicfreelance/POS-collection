import crypto from "node:crypto";
import { assertSigningConfigured, env } from "./env";

/**
 * Entitlement tokens are:  base64url(JSON payload) + "." + base64url(ed25519 sig)
 *
 * The desktop apps bundle the PUBLIC key and verify this offline on every
 * launch — no network round-trip needed while the token is fresh.
 */

function privateKeyObject() {
  assertSigningConfigured();
  return crypto.createPrivateKey({
    key: Buffer.from(env.signingPrivateKey, "base64"),
    format: "der",
    type: "pkcs8",
  });
}

/** base64(DER SPKI) of the public half — derived from the private key if not set explicitly. */
export function publicKeyBase64(): string {
  if (env.signingPublicKey) return env.signingPublicKey;
  const pub = crypto.createPublicKey(privateKeyObject());
  return pub.export({ format: "der", type: "spki" }).toString("base64");
}

export function signEntitlement(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.sign(null, Buffer.from(body), privateKeyObject());
  return `${body}.${sig.toString("base64url")}`;
}

export function verifyEntitlement(token: string): Record<string, unknown> | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const pub = crypto.createPublicKey({
      key: Buffer.from(publicKeyBase64(), "base64"),
      format: "der",
      type: "spki",
    });
    const ok = crypto.verify(
      null,
      Buffer.from(body),
      pub,
      Buffer.from(sig, "base64url"),
    );
    if (!ok) return null;
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
