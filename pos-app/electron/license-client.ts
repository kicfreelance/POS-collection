/**
 * license-client.ts — shared licence client for the Electron main process.
 *
 * SOURCE OF TRUTH. Copies must stay byte-identical:
 *   - pos-app/electron/license-client.ts
 *   - POS-DUALSCREEN/electron/license-client.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What this protects against (and what it can't) — see SECURITY.md:
 *   • The client holds ONLY the Ed25519 PUBLIC key. It cannot mint or extend a
 *     licence, so no keygen is possible and a spoofed licence server is rejected
 *     by the signature check.
 *   • Entitlement tokens are signed server-side, bound to a machine fingerprint,
 *     and product-scoped. Verified fully offline on every launch. Perpetual
 *     licences never expire; time-limited ones do (+ offline grace).
 *   • The local cache is HMAC-tagged (keyed off the fingerprint), so it can't be
 *     hand-edited or copied to another machine.
 *   • A monotonic `seenTime` high-water mark defeats system-clock rollback.
 *   • It does NOT stop someone editing the app's own JS to skip the call. That
 *     needs patching every install and re-patching after every update; raise the
 *     bar further with a native addon / V8 bytecode / asar integrity.
 *
 * Node built-ins only. Assumes a global `fetch` (Electron 44 / Node 20+); the
 * legacy Win7 build (Electron 22) would need a fetch polyfill here and in
 * electron/setup-ipc.ts alike.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

/* ------------------------------------------------------------------ config */

/** PUBLIC signing key of the licence server (base64 SPKI DER). */
export const LICENSE_PUBLIC_KEY_B64 =
  "MCowBQYDK2VwAyEA3Y64WyCAm3y0dW+1H/XoUTMUqvgfb4fXuow9T5lCZBY=";

/** Base URL of the deployed licence server. */
export const LICENSE_SERVER_URL =
  "https://license-server-app-production.up.railway.app";

const OFFLINE_GRACE_DAYS = 5;
const CLOCK_SKEW_SEC = 24 * 3600; // tolerated backward clock drift before we distrust it
const HTTP_TIMEOUT_MS = 8000;

/* -------------------------------------------------------------- fingerprint */

/**
 * Stable per-machine id. Uses the OS install GUID only — survives NIC / MAC /
 * RAM / disk / GPU changes. It changes on an OS reinstall or a different PC,
 * which is exactly what the transfer flow is for.
 *
 * `fallbackIdFile` (pass `<userData>/license/machine-id`) is consulted only when
 * the OS GUID can't be read, so those machines still get a stable, unique id
 * instead of all hashing to the same value.
 */
export function machineFingerprint(fallbackIdFile?: string): string {
  let hwId = "";
  try {
    if (process.platform === "win32") {
      const out = execSync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true },
      );
      hwId = out.match(/MachineGuid\s+REG_SZ\s+\{?([0-9a-fA-F-]{36})\}?/)?.[1] ?? "";
    } else if (process.platform === "darwin") {
      hwId =
        execSync("ioreg -rd1 -c IOPlatformExpertDevice", { encoding: "utf8" }).match(
          /IOPlatformUUID"\s*=\s*"([^"]+)"/,
        )?.[1] ?? "";
    } else {
      for (const p of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
        try {
          const v = fs.readFileSync(p, "utf8").trim();
          if (v) {
            hwId = v;
            break;
          }
        } catch {
          /* try next */
        }
      }
    }
  } catch {
    /* handled below */
  }

  if (!hwId && fallbackIdFile) hwId = readOrCreateRandomId(fallbackIdFile);
  if (!hwId) hwId = `weak|${os.hostname()}|${os.platform()}|${os.arch()}|${os.totalmem()}`;

  return crypto.createHash("sha256").update(`posfp1|${hwId.toLowerCase()}`).digest("hex");
}

function readOrCreateRandomId(file: string): string {
  try {
    const v = fs.readFileSync(file, "utf8").trim();
    if (v) return v;
  } catch {
    /* create below */
  }
  const id = crypto.randomUUID();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, id, { flag: "wx" });
    return id;
  } catch {
    try {
      return fs.readFileSync(file, "utf8").trim() || id;
    } catch {
      return id;
    }
  }
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
  /** true => this licence has no time limit; the client ignores expiresAt. */
  perpetual?: boolean;
}

export function verifyToken(
  token: string,
  publicKeyB64 = LICENSE_PUBLIC_KEY_B64,
): Entitlement | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const pub = crypto.createPublicKey({
      key: Buffer.from(publicKeyB64, "base64"),
      format: "der",
      type: "spki",
    });
    if (!crypto.verify(null, Buffer.from(body), pub, Buffer.from(sig, "base64url"))) {
      return null;
    }
    const e = JSON.parse(Buffer.from(body, "base64url").toString()) as Entitlement;
    return e && e.v === 1 ? e : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------- cache (tamper-evident) */

export interface LicenseCache {
  token: string;
  key: string; // licence key, so heartbeat / release work without re-prompting
  expiresAt: number; // unix seconds, from the token
  seenTime: number; // unix seconds: highest time ever trusted (anti clock-rollback)
  savedAt: number; // ms
}

function cacheMacKey(fingerprint: string): Buffer {
  // Not a true secret (the fingerprint is derivable) — its job is to force an
  // attacker to reproduce the real fingerprint logic AND this construction
  // rather than just dropping a JSON file in place. The real barrier is the
  // Ed25519 signature on the token itself.
  return crypto.createHash("sha256").update(`poscache1|${fingerprint}`).digest();
}

function stableStringify(o: Record<string, unknown>): string {
  return JSON.stringify(o, Object.keys(o).sort());
}

export function loadCache(file: string, fingerprint: string): LicenseCache | null {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown> & {
      mac?: string;
    };
    const mac = String(raw.mac ?? "");
    delete raw.mac;
    const expect = crypto
      .createHmac("sha256", cacheMacKey(fingerprint))
      .update(stableStringify(raw))
      .digest("hex");
    if (
      mac.length !== expect.length ||
      !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))
    ) {
      return null;
    }
    return raw as unknown as LicenseCache;
  } catch {
    return null;
  }
}

export function saveCache(
  file: string,
  fingerprint: string,
  c: Omit<LicenseCache, "savedAt">,
): void {
  const body: LicenseCache = { ...c, savedAt: Date.now() };
  const mac = crypto
    .createHmac("sha256", cacheMacKey(fingerprint))
    .update(stableStringify(body as unknown as Record<string, unknown>))
    .digest("hex");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...body, mac }));
}

export function clearCache(file: string): void {
  try {
    fs.rmSync(file, { force: true });
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------- evaluate */

export type LicenseState = "ok" | "grace" | "invalid";

export interface Evaluation {
  state: LicenseState;
  entitlement: Entitlement | null;
  reason?: string;
}

export function evaluate(
  cache: LicenseCache | null,
  fingerprint: string,
  opts: { graceDays?: number; product?: Entitlement["product"] } = {},
): Evaluation {
  const graceDays = opts.graceDays ?? OFFLINE_GRACE_DAYS;
  if (!cache) return { state: "invalid", entitlement: null, reason: "no_license" };

  const e = verifyToken(cache.token);
  if (!e) return { state: "invalid", entitlement: null, reason: "bad_signature" };
  if (e.status !== "active") return { state: "invalid", entitlement: e, reason: e.status };
  if (e.fingerprint !== fingerprint) {
    return { state: "invalid", entitlement: e, reason: "wrong_machine" };
  }
  if (opts.product && e.product !== opts.product) {
    return { state: "invalid", entitlement: e, reason: "wrong_product" };
  }

  // Perpetual licence: no time limit at all, so there is nothing to expire and
  // nothing a rolled-back clock can gain.
  if (e.perpetual) return { state: "ok", entitlement: e };

  const nowSec = Math.floor(Date.now() / 1000);
  const rolledBack = cache.seenTime - nowSec > CLOCK_SKEW_SEC;
  const effectiveNow = Math.max(nowSec, cache.seenTime);

  if (effectiveNow <= e.expiresAt) {
    return rolledBack
      ? { state: "grace", entitlement: e, reason: "clock_rollback" }
      : { state: "ok", entitlement: e };
  }
  if (effectiveNow <= e.expiresAt + graceDays * 86_400) {
    return {
      state: "grace",
      entitlement: e,
      reason: rolledBack ? "clock_rollback" : "expired_offline",
    };
  }
  return { state: "invalid", entitlement: e, reason: "expired_offline" };
}

/** Fold freshly trusted timestamps into the monotonic high-water mark. */
export function bumpSeenTime(cache: LicenseCache, ...times: number[]): number {
  return Math.max(
    cache.seenTime,
    Math.floor(Date.now() / 1000),
    ...times.filter((t) => Number.isFinite(t)),
  );
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

export class LicenseError extends Error {
  code: string;
  status: number;
  data: any;
  constructor(code: string, status: number, data: unknown) {
    super(code);
    this.name = "LicenseError";
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

const HARD_REJECTIONS = new Set([
  "revoked",
  "suspended",
  "expired",
  "activation_revoked",
  "activation_locked",
  "machine_blocked",
  "not_activated",
  "invalid_key",
  "product_mismatch",
]);

async function post(pathname: string, payload: unknown): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`${LICENSE_SERVER_URL.replace(/\/$/, "")}${pathname}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.valid === false) {
      throw new LicenseError(data?.error ?? `http_${res.status}`, res.status, data);
    }
    return data;
  } catch (err) {
    if (err instanceof LicenseError) throw err;
    throw new LicenseError("network_error", 0, { message: String(err) });
  } finally {
    clearTimeout(timer);
  }
}

export interface ActivateCtx {
  fingerprint: string;
  role: "standalone" | "server";
  hostname?: string;
  appVersion?: string;
}

/**
 * Activate this machine.
 *
 * Offline-forever model: there is no self-service transfer. A machine already on
 * record re-activates for free; a new machine either fits within the licence's
 * activation budget or the server refuses it — `LicenseError` with code
 * `activation_limit_reached` (payload: `used`, `max`, `machines`),
 * `activation_locked`, or `machine_blocked`. Surface those to the user with a
 * "contact your vendor" message; only the vendor can grant another activation.
 */
export async function activateAndCache(
  file: string,
  key: string,
  ctx: ActivateCtx,
): Promise<Evaluation> {
  key = key.trim().toUpperCase();
  const res: ActivateResult = await post("/api/v1/activate", { key, ...ctx });

  const ent = verifyToken(res.token);
  if (!ent || ent.fingerprint !== ctx.fingerprint) {
    throw new LicenseError("token_verify_failed", 0, {});
  }
  saveCache(file, ctx.fingerprint, {
    token: res.token,
    key,
    expiresAt: res.expiresAt,
    seenTime: Math.max(Math.floor(Date.now() / 1000), ent.issuedAt),
  });
  return evaluate(loadCache(file, ctx.fingerprint), ctx.fingerprint, { product: ent.product });
}

/**
 * Periodic revalidation. Refreshes the cached token, advances `seenTime`, and
 * returns the new state. A hard rejection (revoked / expired / suspended)
 * clears the cache so the next launch is blocked. Network errors are swallowed
 * — the app keeps running on the cached token until it ages past grace.
 */
export async function heartbeatAndCache(
  file: string,
  ctx: ActivateCtx & {
    activeTerminals?: number;
    terminals?: Array<{ machineId: string; hostname?: string; lastSeen?: number }>;
  },
): Promise<Evaluation> {
  const cache = loadCache(file, ctx.fingerprint);
  if (!cache) return { state: "invalid", entitlement: null, reason: "no_license" };

  try {
    const res = await post("/api/v1/heartbeat", {
      key: cache.key,
      fingerprint: ctx.fingerprint,
      appVersion: ctx.appVersion,
      hostname: ctx.hostname,
      activeTerminals: ctx.activeTerminals,
      terminals: ctx.terminals,
    });
    const ent = verifyToken(res.token);
    if (ent && ent.fingerprint === ctx.fingerprint) {
      saveCache(file, ctx.fingerprint, {
        token: res.token,
        key: cache.key,
        expiresAt: res.expiresAt,
        seenTime: bumpSeenTime(cache, ent.issuedAt),
      });
    }
  } catch (e) {
    if (e instanceof LicenseError && HARD_REJECTIONS.has(e.code)) {
      clearCache(file);
      return { state: "invalid", entitlement: null, reason: e.code };
    }
    // Network error: keep the token, but still advance seenTime so the clock
    // can't be wound back between heartbeats.
    saveCache(file, ctx.fingerprint, {
      token: cache.token,
      key: cache.key,
      expiresAt: cache.expiresAt,
      seenTime: bumpSeenTime(cache),
    });
  }
  return evaluate(loadCache(file, ctx.fingerprint), ctx.fingerprint);
}

/**
 * Uninstall / "stop using on this PC". Tells the server (best effort) and wipes
 * the local cache so this machine stops working immediately.
 *
 * Note: in the offline-forever model this does NOT free an activation slot —
 * the machine stays on the ledger. Only the vendor deleting the machine row in
 * /admin frees a slot. So there is no self-service "move to another PC".
 */
export async function releaseLicense(file: string, fingerprint: string): Promise<void> {
  const cache = loadCache(file, fingerprint);
  try {
    if (cache) await post("/api/v1/deactivate", { key: cache.key, fingerprint });
  } catch {
    /* best effort */
  } finally {
    clearCache(file);
  }
}
