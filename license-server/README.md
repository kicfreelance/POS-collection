# license-server

Licensing backend for **pos-app** (single machine) and **POS-DUALSCREEN** (server + terminals).
Next.js App Router + Drizzle + Postgres. Deploys to Railway.

- Opaque license keys; all meaning lives in the DB.
- Activation returns a short-lived **Ed25519-signed entitlement token** the desktop
  apps verify **offline** on every launch. A scheduled heartbeat refreshes it.
- One key covers a whole dual-screen site — see [Multi-screen model](#multi-screen-model).

---

## Hosting: Railway (not Vercel Hobby)

Vercel's free plan is non-commercial only and bundles no database — don't use it for a
paid product's licensing backend. **Railway Hobby (~$5/mo) + Railway Postgres** is the
fit: commercial-OK, always on, DB in the same project.

### Deployed

- **Project**: `license-server` on Railway (`kicfreelance's Projects`)
- **Live**: <https://license-server-app-production.up.railway.app>
- **Services**: `license-server-app` (this Next.js app) + `Postgres`
- Production secrets live in `.env.production.local` (gitignored). `LICENSE_SIGNING_PUBLIC_KEY`
  is also served at `/api/v1/public-key`.

Redeploy after code changes:

```bash
cd license-server
railway up            # builds & deploys this folder to license-server-app
railway logs          # tail runtime logs
```

### First-time deploy (already done — for reference)

1. `railway init -n license-server`
2. `railway add --database postgres`
3. `railway add --service license-server-app --variables "K=V" ...` — set:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{ Postgres.DATABASE_URL }}` (private networking) |
   | `DATABASE_SSL` | `require` — Railway's Postgres image is `postgres-ssl` |
   | `ADMIN_USER` / `ADMIN_PASSWORD` | admin web UI (HTTP Basic on `/admin`) |
   | `ADMIN_API_TOKEN` | bearer token for the admin REST API |
   | `LICENSE_SIGNING_PRIVATE_KEY` | from `npm run keypair` |
   | `LICENSE_SIGNING_PUBLIC_KEY` | from `npm run keypair` (also embed in the apps) |
   | `LICENSE_TOKEN_TTL_DAYS` | `30` (offline budget for the desktop apps) |

4. `railway up`, then `railway domain` for the public URL.

`railway.json` sets the start command to `npm run db:migrate && npm run start`
(migrations run on every boot; `scripts/migrate.mjs` needs only runtime deps).
Healthcheck: `/api/health`. Commit the generated migration (`npm run db:generate`).

### Local dev

```bash
cp .env.example .env          # fill in DATABASE_URL etc.
npm install
npm run keypair               # paste both keys into .env
npm run db:generate           # writes drizzle/0000_*.sql
npm run db:migrate            # applies it
npm run dev                   # http://localhost:4100  -> redirects to /admin
```

Any Postgres works locally, e.g.:
`docker run -e POSTGRES_PASSWORD=pos -e POSTGRES_DB=license_server -p 5432:5432 postgres:16`

---

## API

Public (called by the desktop apps):

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/activate` | first activation / re-activation; returns a signed token |
| `POST` | `/api/v1/heartbeat` | refresh token, report seat usage, revalidate |
| `POST` | `/api/v1/deactivate` | free the seat + release the machine binding |
| `GET`  | `/api/v1/public-key` | the Ed25519 public key (tooling / rotation) |
| `GET`  | `/api/health` | DB ping |

Admin (`Authorization: Bearer $ADMIN_API_TOKEN`):

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/v1/licenses` | list with activations + terminals |
| `POST` | `/api/v1/licenses` | mint a key (`product`, `seatLimit`, `expiresAt`, …) |
| `PATCH`| `/api/v1/licenses/:id` | `status` (revoke/suspend), `seatLimit`, `expiresAt`, `releaseBind` |
| `DELETE`| `/api/v1/licenses/:id` | delete |

Web admin UI at **`/admin`** (HTTP Basic) — mint keys, revoke, release a binding, see
which installs are online and their live seat count.

```bash
# mint a dual-screen key for 5 terminals
curl -sX POST https://<host>/api/v1/licenses \
  -H "authorization: Bearer $ADMIN_API_TOKEN" -H 'content-type: application/json' \
  -d '{"product":"pos-dualscreen","seatLimit":5,"customerName":"Acme Cafe"}'
```

---

## One server, two products

The `product` column on each key is `pos-standard` or `pos-dualscreen`; the key prefix
(`PST-…` / `PSD-…`) mirrors it. `activate` rejects a key whose `product` doesn't match
what the app sends. `pos-standard` is just the degenerate case: `seatLimit = 1`, the one
machine both holds the license and is the only screen.

## Multi-screen model

**The license lives on the dual-screen SERVER machine only. Terminals never contact
this server.** Because Terminals render the Server's web app, the Server is the single
enforcement point for every screen.

1. Server's first run → admin enters the key → `activate` with `role:"server"`, its
   machine fingerprint, `product:"pos-dualscreen"`. Server caches the signed token and
   heartbeats every 12–24 h (offline grace `OFFLINE_GRACE_DAYS` in the client).
2. Each Terminal generates a stable `machineId` (stored in
   `%APPDATA%\pos-dualscreen\node-config.json`) and POSTs it to a small
   `POST /api/terminal/register` route **on the Server** on launch + every 60 s.
3. The Server keeps an in-process registry of connected Terminals and enforces
   `seatLimit` locally. New Terminal over the limit → Server returns 403 → Terminal
   shows "License seats full (N/N)".
4. A guard in the Server's Next middleware serves a "License inactive" page instead of
   the POS whenever its own entitlement is invalid/expired/revoked — which blanks the
   Server window **and every Terminal at once**, since they load the same app.
5. The Server reports its live seat count up on each heartbeat, so `/admin` shows real
   usage and one key run at multiple sites stands out.

The key is bound to the Server's fingerprint on first activation. A different machine
can only take over via `transfer: true` (capped by `maxTransfers`), or after a
self-service `deactivate`, or an admin "Release bind".

See `client-example/` for the code that goes into the desktop apps.
