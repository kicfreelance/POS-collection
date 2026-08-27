/**
 * dualscreen-server-gate.ts — POS-DUALSCREEN, SERVER ROLE ONLY.
 *
 * The dual-screen design: Terminals run no backend, they just load the Server's
 * web app in an Electron window. That makes licensing simple:
 *
 *   1. Only the Server holds and activates the license key (role: "server").
 *   2. The Server counts connected Terminals and enforces `seatLimit` itself.
 *      Terminals never contact the license server.
 *   3. One guard in the Server's Next app disables the whole UI when the
 *      license is invalid -- which takes down the Server window AND every
 *      Terminal at once, because they all render the same app.
 *
 * This file sketches the two pieces you add to POS-DUALSCREEN. Wire them to the
 * app's real DB layer / Next middleware.
 */

/* ============================================================ 1. seat registry
 * In-memory is fine: the Server is a single process, and Terminals re-register
 * within one heartbeat after a Server restart. Swap for a table if you want the
 * count to survive restarts without a re-register gap.
 */

interface TerminalRow {
  machineId: string;
  hostname: string;
  lastSeen: number;
}

const ACTIVE_WINDOW_MS = 2 * 60_000; // "connected" = seen in the last 2 minutes
const terminals = new Map<string, TerminalRow>();

export function pruneTerminals(): void {
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  for (const [id, t] of terminals) if (t.lastSeen < cutoff) terminals.delete(id);
}

export function activeTerminals(): TerminalRow[] {
  pruneTerminals();
  return [...terminals.values()];
}

/**
 * Call from  POST /api/terminal/register  and  POST /api/terminal/heartbeat
 * (new routes you add to the POS-DUALSCREEN Server app).
 *
 * `seatLimit` comes from the verified entitlement token the Server holds.
 */
export function registerTerminal(
  machineId: string,
  hostname: string,
  seatLimit: number,
):
  | { ok: true; active: number; seatLimit: number }
  | { ok: false; reason: "seat_limit"; active: number; seatLimit: number } {
  pruneTerminals();
  const known = terminals.has(machineId);
  if (!known && terminals.size >= seatLimit) {
    return { ok: false, reason: "seat_limit", active: terminals.size, seatLimit };
  }
  terminals.set(machineId, { machineId, hostname, lastSeen: Date.now() });
  return { ok: true, active: terminals.size, seatLimit };
}

/* Example route handler (Next App Router) in POS-DUALSCREEN:
 *
 *   // src/app/api/terminal/register/route.ts   (Server role only)
 *   import { registerTerminal } from "@/lib/terminal-registry";
 *   import { getEntitlement } from "@/lib/license";      // verified token holder
 *
 *   export async function POST(req: Request) {
 *     const { machineId, hostname } = await req.json();
 *     const ent = getEntitlement();
 *     if (!ent) return Response.json({ ok: false, error: "server_unlicensed" }, { status: 403 });
 *     const r = registerTerminal(String(machineId), String(hostname ?? ""), ent.seatLimit);
 *     return Response.json(r, { status: r.ok ? 200 : 403 });
 *   }
 *
 * The Terminal's Electron main process generates a machineId once (store it in
 * %APPDATA%\pos-dualscreen\node-config.json next to the role/serverHost it
 * already keeps) and POSTs here on launch + every 60s. On a 403 it shows a
 * "License seats full (N/N)" screen instead of loading the POS.
 */

/* ========================================================= 2. whole-app gate
 * Add to POS-DUALSCREEN Server's  src/middleware.ts. Because every Terminal
 * renders this same app, rewriting to /license-blocked here blacks out ALL
 * screens simultaneously.
 */

/*
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getLicenseState } from "@/lib/license"; // "ok" | "grace" | "invalid"

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (
    p.startsWith("/license-blocked") ||
    p.startsWith("/_next") ||
    p.startsWith("/api/health")
  ) {
    return NextResponse.next();
  }
  if (getLicenseState() === "invalid") {
    return NextResponse.rewrite(new URL("/license-blocked", req.url));
  }
  return NextResponse.next(); // "grace" still serves, show a banner in the layout
}
*/

/* ============================================ 3. what the Server reports upstream
 * On each license-server heartbeat the Server sends its live seat count so your
 * admin dashboard shows real usage and can spot one key used at many sites:
 *
 *   import { heartbeat } from "./license-client";
 *   import { activeTerminals } from "./terminal-registry";
 *
 *   const live = activeTerminals();
 *   const res = await heartbeat(licenseKey, {
 *     fingerprint,
 *     activeTerminals: live.length,
 *     terminals: live.map((t) => ({
 *       machineId: t.machineId,
 *       hostname: t.hostname,
 *       lastSeen: t.lastSeen,
 *     })),
 *     appVersion: app.getVersion(),
 *   });
 *   saveCachedToken(tokenFile, res.token, res.expiresAt);
 */
