/**
 * license-client.ts — POS-DUALSCREEN (Electron main process), SERVER ROLE.
 *
 * Only the Server machine activates against the license server (role: "server")
 * and revalidates on a schedule. Terminal machines never use this file — they
 * register their machineId with the Server instead (see dualscreen-server-gate.ts).
 *
 * The Ed25519 entitlement token is verified OFFLINE on every launch. Only Node
 * built-ins are used — no extra dependencies.
 *
 * Kept in sync with pos-app/electron/license-client.ts and the source of truth
 * at license-server/client-example/license-client.ts.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

/* ------------------------------------------------------------------ config */

/** PUBLIC signing key of the license server (from `npm run keypair`). */
export const LICENSE_PUBLIC_KEY_B64 =
  "MCowBQYDK2VwAyEA3Y64WyCAm3y0dW+1H/XoUTMUqvgfb4fXuow9T5lCZBY=";

/** Base URL of the deployed license server. */
export const LICENSE_SERVER_URL = "https://license-server-app-production.up.railway.app";

/** Days past token expiry the app still runs (offline grace) before it blocks. */
const OFFLINE_GRACE_DAYS = 5;

/* -------------------------------------------------------------- fingerprint */

/**
 * Stable per-machine id. Mixes a hardware-rooted value (so copying %APPDATA%
 * to another PC does NOT carry the identity) with host/platform.
 */
export function machineFingerprint(): string {
  let hwId = "";
  try {
    if (process.platform === "win32") {
      const out = execSync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
      hwId = out.trim().split(/\s+/).pop() ?? "";
    } else if (process.platform === "darwin") {
      hwId =
        execSync("ioreg -rd1 -c IOPlatformExpertDevice", { encoding: "utf8" }).match(
          /IOPlatformUUID"\s*=\s*"([^"]+)"/,
        )?.[1] ?? "";
    } else {
      hwId = fs.readFileSync("/etc/machine-id", "utf8").trim();
    }
  } catch {
    /* fall through to host-only basis */
  }
  const basis = [hwId, os.hostname(), os.platform(), os.arch()].join("|");
  return crypto.createHash("sha256").update(basis).digest("hex");
}

/* ----------------------------------------------------------- token verify */

export interface Entitlement {
  v: 1;
  licenseId: string;
  product: "pos-standard" | "pos-dualscreen";
  edition: string;
  seatLimit: number;
  fingerprint: string;
  role: "standalone" | "server";
  status: "active" | "suspended" | "revoked";
  tokenVersion: number;
  issuedAt: number;
  expiresAt: number;
}

export function verifyToken(token: string, publicKeyB64 = LICENSE_PUBLIC_KEY_B64): Entitlement | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const pub = crypto.createPublicKey({
      key: Buffer.from(publicKeyB64, "base64"),
      format: "der",
      type: "spki",
    });
    const ok = crypto.verify(null, Buffer.from(body), pub, Buffer.from(sig, "base64url"));
    if (!ok) return null;
    return JSON.parse(Buffer.from(body, "base64url").toString()) as Entitlement;
  } catch {
    return null;
  }
}

export type LicenseState = "ok" | "grace" | "invalid";

export function evaluate(
  token: string | null,
  fingerprint: string,
  graceDays = OFFLINE_GRACE_DAYS,
): { state: LicenseState; entitlement: Entitlement | null } {
  const e = token ? verifyToken(token) : null;
  if (!e) return { state: "invalid", entitlement: null };
  if (e.status !== "active") return { state: "invalid", entitlement: e };
  if (e.fingerprint !== fingerprint) return { state: "invalid", entitlement: e };

  const now = Date.now() / 1000;
  if (now <= e.expiresAt) return { state: "ok", entitlement: e };
  if (now <= e.expiresAt + graceDays * 86_400) return { state: "grace", entitlement: e };
  return { state: "invalid", entitlement: e };
}

/* ---------------------------------------------------------- token cache */

export function loadCachedToken(file: string): string | null {
  try {
    return (JSON.parse(fs.readFileSync(file, "utf8")) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

export function saveCachedToken(file: string, token: string, expiresAt: number): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ token, expiresAt, savedAt: Date.now() }));
}

/* --------------------------------------------------------- server calls */

interface ActivateResult {
  token: string;
  expiresAt: number;
  license: {
    product: string;
    edition: string;
    seatLimit: number;
    status: string;
    expiresAt: string | null;
  };
}

class LicenseError extends Error {
  code: string;
  status: number;
  data: unknown;
  constructor(code: string, status: number, data: unknown) {
    super(code);
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

async function post(pathname: string, payload: unknown): Promise<any> {
  const res = await fetch(`${LICENSE_SERVER_URL.replace(/\/$/, "")}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.valid === false) {
    throw new LicenseError(data?.error ?? "request_failed", res.status, data);
  }
  return data;
}

export function activate(
  key: string,
  opts: {
    fingerprint: string;
    role?: "standalone" | "server";
    hostname?: string;
    appVersion?: string;
    transfer?: boolean;
  },
): Promise<ActivateResult> {
  return post("/api/v1/activate", { key, ...opts });
}

export function heartbeat(
  key: string,
  opts: {
    fingerprint: string;
    activeTerminals?: number;
    terminals?: Array<{ machineId: string; hostname?: string; lastSeen?: number }>;
    appVersion?: string;
    hostname?: string;
  },
): Promise<{ token: string; expiresAt: number; seatLimit: number; warning?: string }> {
  return post("/api/v1/heartbeat", { key, ...opts });
}

export function deactivate(key: string, fingerprint: string): Promise<{ ok: true }> {
  return post("/api/v1/deactivate", { key, fingerprint });
}

export { LicenseError };
