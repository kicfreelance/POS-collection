# client-example

`license-client.ts` here is the **source of truth**. Byte-identical copies live at:

- `pos-app/electron/license-client.ts`
- `POS-DUALSCREEN/electron/license-client.ts`

Both apps are already wired up — this folder is just where the shared module and
the dual-screen server-gate sketch are kept under version control. When you edit
`license-client.ts`, copy it to both `electron/` dirs (they must match).

## How it's wired (real code, not pseudo)

**pos-app** (`role: "standalone"`, `product: "pos-standard"`):
- `electron/license-gate.ts` — `ensureLicensed()` blocks `main.ts` startup before
  Postgres/server start; opens `electron/license.html` if unlicensed;
  `startHeartbeat()` revalidates every 12 h and quits on a hard rejection.
- `electron/license.html` — key entry + "Move licence to another PC" (calls
  `releaseLicense`).

**POS-DUALSCREEN** (`role: "server"`, `product: "pos-dualscreen"`):
- `electron/license-gate.ts` — same, but only runs for the **server** role
  (inside `startAsServer()`). `startHeartbeat(getActiveTerminals)` reports live
  seat usage upstream.
- `electron/terminal-register.ts` + `electron/terminal-id.ts` — **terminal** role
  posts its `machineId` to the Server's `POST /api/terminal/register` every 60 s;
  quits on HTTP 403 (seat limit / server unlicensed).
- `dualscreen-server-gate.ts` (this folder) — the in-Next seat registry + the
  `middleware.ts` gate. **Still to add** to the POS-DUALSCREEN Next app:
  `src/lib/terminal-registry.ts`, `src/app/api/terminal/register/route.ts`,
  `src/middleware.ts` licence gate, and a `/license-blocked` page. These need the
  Next 16 bundled docs check first.

## Module API (`license-client.ts`)

| Function | Use |
|---|---|
| `machineFingerprint(fallbackIdFile?)` | stable machine id — OS install GUID only (survives NIC/MAC/RAM/disk changes) |
| `evaluate(cache, fp, {product})` | `ok` \| `grace` \| `invalid` + `reason`, offline, clock-rollback aware |
| `activateAndCache(file, key, ctx, confirmTransfer)` | activate; auto-prompts for machine transfer via the callback; caches on success |
| `heartbeatAndCache(file, ctx)` | periodic revalidation; clears cache on hard rejection; ignores network errors |
| `releaseLicense(file, fp)` | "move to another PC" — deactivates server-side + wipes local cache |
| `loadCache` / `saveCache` / `clearCache` | HMAC-tagged, fingerprint-bound token cache |

See `../SECURITY.md` for the threat model.
