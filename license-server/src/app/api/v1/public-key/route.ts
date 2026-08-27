import { publicKeyBase64 } from "@/lib/crypto";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Convenience endpoint for tooling / key rotation. Production builds should
 * still EMBED the public key rather than fetch it at runtime.
 */
export async function GET() {
  try {
    return json({
      alg: "ed25519",
      format: "spki-der-base64",
      publicKey: publicKeyBase64(),
    });
  } catch {
    return json({ error: "signing_key_not_configured" }, 503);
  }
}
