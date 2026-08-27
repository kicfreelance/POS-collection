# POS Ecosystem — Project Map

This folder contains **three separate, independently-versioned applications**. They are
not part of one build, one deploy pipeline, or one codebase — treat each as its own
project. Do not assume a change in one should be mirrored into another unless
explicitly asked to.

```
POS/
├── pos-app/          the regular, single-machine POS application
├── POS-DUALSCREEN/   variant for deployments spanning more than one PC
└── license-server/   separate licensing backend (not started yet)
```

## 1. `pos-app/` — the main POS application

The primary, regular POS product. A universal Windows desktop app:

- **Stack**: Electron + Next.js (App Router) + embedded PostgreSQL (`embedded-postgres`,
  real Postgres binaries bundled — no external DB install required on the target machine).
- **Deployment model**: one self-contained install per machine. Each install runs its
  own embedded Postgres instance and owns its own data — there is no networking or
  multi-machine data sharing built in.
- **Packaging**: two Windows build targets — `electron-builder.win10.json` (current
  Electron, Windows 10/11) and `electron-builder.win7.json` (Electron pinned to the last
  version that supports Windows 7/8/8.1). See `pos-app/PACKAGING.md`.
- **Features**: full retail checkout, plus an optional Restaurant Mode (tile-based POS
  UI, Dine In/Take Away + table management, KOT printing with multi-station routing,
  order lifecycle held open until served/paid), a Dashboard home page with sales
  charts, RBAC, inventory/GRN, promotions/coupons, customers/credit, shifts, and
  reporting.
- **Status**: actively developed and working; see `pos-app/SESSION_NOTES.md` for the
  most recent in-progress/handoff notes.

This is the one to treat as authoritative unless told otherwise.

## 2. `POS-DUALSCREEN/` — multi-PC variant

Started as a full copy of `pos-app`'s source (copied 2026-08-27, same features, same
code, at that point in time — check the git history / diffs going forward since it will
diverge).

- **Purpose**: `pos-app` is built around one embedded Postgres instance per single
  machine. `POS-DUALSCREEN` exists because some deployments need **more than one PC**
  involved — e.g. multiple terminal/register machines that need to work off the same
  data, rather than each machine being its own fully isolated install. That is the
  entire reason this is a separate project and not just a setting inside `pos-app`.

- **Architecture (implemented)**: Server / Terminal model, one app, one installer.
  - **First launch, no local config yet** → shows a first-run setup screen
    (`electron/setup.html`, a plain static page, not part of the Next app — so it works
    before any database exists) asking "Server or Terminal?". The choice is saved to
    `%APPDATA%\pos-dualscreen\node-config.json` and the app relaunches itself into that
    role. To reset a machine's role, delete that file (or launch with a different
    `--user-data-dir`) and relaunch.
  - **Server role**: exactly like `pos-app` — starts its own embedded Postgres
    (`127.0.0.1`-only, never exposed to the network) and the Next.js app, runs
    migrations/seed, and opens its own checkout window at `http://127.0.0.1:3000`. The
    only difference from `pos-app`: the Next.js server binds to `0.0.0.0` (see
    `electron/production-env.ts` for packaged builds, and the `-H 0.0.0.0` flag on
    `dev:next` for dev mode) so Terminal PCs on the LAN can reach it.
  - **Terminal role**: starts **no** local Postgres, runs **no** local Next.js server at
    all. Its Electron window just loads `http://<serverHost>:<serverPort>` directly —
    it's a thin client pointed at the Server's web app. `serverHost`/`serverPort` are
    entered once on the Terminal's own setup screen (with a "Test connection" button
    that calls the Server's `/api/health`).
  - **Printing**: printer-name assignments (Settings → Printers) live only in the
    Server's database. Both roles resolve "which printer for this ticket" over HTTP via
    a small `GET /api/print-config` route (`electron/printing.ts`) instead of querying
    Postgres directly — this is what lets a Terminal print without ever touching the
    Server's database connection. Known caveat: a printer name stored centrally only
    means something if that same printer name exists on whichever physical machine is
    doing the printing (e.g. a shared network printer installed under the same name on
    every PC) — there is no per-machine printer override yet.
  - **Dev-mode LAN quirk**: `next dev`'s Turbopack blocks cross-origin HMR/asset
    requests by default; `next.config.ts` auto-allows this machine's own LAN IPs via
    `os.networkInterfaces()` so a Terminal can load a Server's `next dev` instance
    during development. This restriction doesn't exist in packaged builds (standalone
    production server), so it's a dev-only fix.
  - **App identity**: deliberately renamed away from `pos-app`'s (`appId`
    `com.possystem.dualscreen`, `productName` "POS Dual Screen", package name
    `pos-dualscreen`) specifically so its `%APPDATA%` folder never collides with a
    `pos-app` install on the same machine (e.g. a Server PC that's also running the
    regular app for another purpose).
  - **Verified**: tested on one machine by running a real Server instance (fresh DB,
    all migrations, `/login` reachable via the machine's actual LAN IP, not just
    localhost) alongside a separate Electron instance forced into Terminal role
    (isolated `--user-data-dir`) pointed at that LAN IP — confirmed it starts no local
    DB/server and successfully loads the Server's UI. Not verified: two genuinely
    separate physical PCs, real Windows Firewall prompts on first LAN listen, or the
    printer-name-must-match-across-machines assumption above.
- **Conflicts with `pos-app`**: still uses the **same default ports** as `pos-app`
  (Next.js on 3000, embedded Postgres on 54329) and the same `.env` values, so a Server
  role here and a running `pos-app` on the *same* machine still collide on those ports
  — the identity rename only fixed the `%APPDATA%` collision, not the port one.
- **Status**: Server/Terminal setup flow implemented and verified as above. Not yet
  done: an actual NSIS Windows Firewall rule at install time (Windows will prompt on
  first LAN listen instead), and the per-machine printer question noted above.

## 3. `license-server/` — licensing backend

- **Purpose**: license generation/activation/validation/revocation for the desktop
  app(s) above. A separate backend deployed independently (Railway), talking to
  `pos-app` / `POS-DUALSCREEN` over the network for activation — never bundled into
  either desktop build.
- **Stack**: Next.js (App Router) API routes + Drizzle + Postgres. Ed25519-signed
  entitlement tokens the desktop apps verify offline; scheduled heartbeat refresh.
  HTTP-Basic admin UI at `/admin` plus a bearer-auth admin REST API.
- **One key, two products**: each key carries `product` = `pos-standard` |
  `pos-dualscreen` and (dual-screen) a `seatLimit`.
- **Multi-screen model**: the license lives on the dual-screen **Server** machine
  only. Terminals never contact the license server — they load the Server's web app,
  so the Server is the single enforcement point: it counts connected terminals
  against `seatLimit` locally, and one middleware guard blanks every screen at once
  if its license goes invalid. See `license-server/README.md` and
  `license-server/client-example/`.
- **Status**: scaffolded and building. Not yet done: generated migration applied
  against a real deployed DB, wiring the `client-example/` code into the two desktop
  apps, the `POS-DUALSCREEN` `/api/terminal/register` route + Terminal-side machineId.

## Ground rules

- No shared `node_modules`, no shared build/packaging config, no shared deploy
  pipeline between the three.
- `license-server` is a backend service; the other two are desktop apps. They are
  independent codebases even once `license-server` is built — see each project's own
  docs once they exist.
- When asked to work on "the POS app" with no further qualifier, that means
  `pos-app`, not `POS-DUALSCREEN`.
