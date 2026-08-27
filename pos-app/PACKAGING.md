# Packaging the desktop app

The app ships two separate Windows build targets from the **same source tree**
because Electron dropped Windows 7/8/8.1 support after v22, so an app that must
run on those older systems has to stay pinned to an old Electron/Chromium
build, while a modern-Windows build should track current Electron for
security fixes and performance.

| Target | Config file | Electron version | Windows versions | npm script |
|---|---|---|---|---|
| Modern | `electron-builder.win10.json` | latest (currently 44.x, whatever is in `devDependencies`) | Windows 10, 11 | `npm run package:win10` |
| Legacy | `electron-builder.win7.json` | pinned `22.3.27` (last release supporting Win7/8/8.1) | Windows 7, 8, 8.1 | `npm run package:win7` |

Both configs produce an NSIS installer (`asar: false`, `perMachine: false`,
`requestedExecutionLevel: asInvoker`) into `release/win10-11/` and
`release/win7-8/` respectively.

## How the runtime works

- The app embeds real PostgreSQL binaries (`embedded-postgres` +
  `@embedded-postgres/windows-x64`) — no external Postgres install is
  required on the target machine.
- `electron/main.ts` calls `applyProductionEnv()` (only when `app.isPackaged`)
  **before** anything touches the database. This sets `DATABASE_URL`,
  `AUTH_SECRET`, etc. directly on `process.env` for the Electron main process
  itself — not just for the spawned Next.js server — because migrations/seed
  run in-process via their own `pg.Client`.
- `AUTH_SECRET` is generated once on first run and persisted to
  `%APPDATA%\pos-app\auth-secret.txt`.
- The compiled Next.js app (`next build` with `output: "standalone"`) is
  copied into `resources/standalone` and run by spawning Electron's own
  binary as plain Node (`ELECTRON_RUN_AS_NODE=1`), so a packaged build never
  depends on a system Node.js install — required for the Win7/8 target.
- First launch: Postgres cluster is initialized, migrations run
  (`db/migrations/*.sql`, tracked in `schema_migrations`), and a default
  admin user is seeded with a **random 6-digit PIN printed to the console**
  (`Username: admin`, `PIN: xxxxxx`). Change it after first login. Because
  this is a GUI-subsystem app, that console output is not reliably visible
  unless the process's own stdout handle is redirected to a file at launch —
  it does not depend on any interactive terminal.
- If startup fails for any reason, a `startup-error.log` is written to
  `%APPDATA%\pos-app\` and a `dialog.showErrorBox` is shown, so failures are
  never silent.

## A load-bearing electron-builder gotcha

`app-builder-lib`'s file-copy filter (`node_modules/app-builder-lib/out/util/filter.js`)
hardcodes:

```js
if (relative === "node_modules") return false;
```

This unconditionally drops any directory literally named `node_modules` sitting
at the **root** of any copy operation's `from` path — including
`extraResources` entries, not just the main `files` block — and no `filter`
option can override it since the check runs before pattern matching.

Because `.next/standalone/node_modules` is exactly that shape, a naive
`{ "from": ".next/standalone", "to": "standalone" }` entry silently ships a
standalone server with **no node_modules**, which fails at runtime with
`Error: Cannot find module 'next'`. The fix (already applied in both configs)
is a second, explicit `extraResources` entry that points directly *at* the
`node_modules` folder so it's no longer the literal top-level child being
tested:

```json
{ "from": ".next/standalone", "to": "standalone" },
{ "from": ".next/standalone/node_modules", "to": "standalone/node_modules" },
```

## Verification status

**Windows 10/11 build — fully verified end-to-end**, on this machine:
- Fresh install state (`%APPDATA%\pos-app` wiped) → launched `POS.exe`.
- Embedded Postgres started and became ready on port 54329.
- All 9 migrations applied and the admin user was seeded — confirmed by
  querying the packaged app's own Postgres instance directly.
- No `startup-error.log`, empty stderr — clean startup.
- `GET /login` → 200.
- `POST /api/auth/login` with the seeded PIN → 200, sets a signed session
  cookie.
- `GET /api/auth/me` with that cookie → resolves to the Super Admin user.
- `POST /api/auth/login` with a wrong PIN → 401, rejected correctly.

**Windows 7/8/8.1 build — config validated, runtime NOT verified on real
legacy hardware.** `npm run package:win7` successfully downloads Electron
22.3.27 and produces `release/win7-8/win-unpacked/POS.exe` with the same
`node_modules` fix applied, and it visibly boots on this Windows 10 dev
machine. That is not proof it works on actual Windows 7/8. Two real risks
that can only be checked on the real OS:
1. Whether Electron 22's Chromium/V8 build genuinely still runs on Win7/8
   (Electron's own release notes claim this is the last version that does).
2. Whether the bundled `@embedded-postgres/windows-x64` native Postgres
   binary (PostgreSQL 18, built with a modern MSVC toolchain) has a minimum
   Windows API baseline that excludes Windows 7 — this is independent of
   Electron and is not something a build step can validate.

**Before shipping the Win7/8 build to real customers, smoke-test the NSIS
installer from `release/win7-8/` on actual Windows 7 and Windows 8.1
hardware or a VM**, specifically checking that embedded Postgres starts
(watch for `startup-error.log` in `%APPDATA%\pos-app\`).

## Building

```bash
npm run package:win10   # release/win10-11/
npm run package:win7    # release/win7-8/
```

Both run `next build` + `tsc -p electron/tsconfig.json` first, then
`electron-builder` with the respective config.
