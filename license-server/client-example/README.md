# client-example

Reference code to copy into the **desktop apps** (Electron main process). Not part of
the license-server build. These are separate codebases — adapt paths/imports to each.

## Files

| File | Goes into | Role |
|---|---|---|
| `license-client.ts` | `pos-app` **and** `POS-DUALSCREEN` (Server role) | fingerprint, offline token verify, `activate` / `heartbeat` / `deactivate` |
| `dualscreen-server-gate.ts` | `POS-DUALSCREEN` (Server role only) | Terminal seat registry + whole-app gate sketch |

Before shipping, in `license-client.ts` set:

- `LICENSE_PUBLIC_KEY_B64` — the public key from `npm run keypair` on the server.
- `LICENSE_SERVER_URL` — your deployed Railway URL.

## pos-app (standalone) flow

```ts
import { app } from "electron";
import path from "node:path";
import {
  machineFingerprint, evaluate, loadCachedToken, saveCachedToken,
  activate, heartbeat, LicenseError,
} from "./license-client";

const fp = machineFingerprint();
const tokenFile = path.join(app.getPath("userData"), "license", "token.json");

// on boot: verify the cached token offline first — no network needed if fresh
let { state } = evaluate(loadCachedToken(tokenFile), fp);

// no valid token yet -> ask the user for a key, then:
async function enterKey(key: string) {
  try {
    const r = await activate(key, {
      fingerprint: fp, role: "standalone",
      hostname: require("node:os").hostname(), appVersion: app.getVersion(),
    });
    saveCachedToken(tokenFile, r.token, r.expiresAt);
  } catch (e) {
    if (e instanceof LicenseError && e.code === "already_activated_elsewhere") {
      // offer "move license to this PC" -> call activate(key, { ..., transfer: true })
    }
    throw e;
  }
}

// background, every ~12h and on network regain:
async function refresh(key: string) {
  try {
    const r = await heartbeat(key, { fingerprint: fp, appVersion: app.getVersion() });
    saveCachedToken(tokenFile, r.token, r.expiresAt);
  } catch (e) {
    if (e instanceof LicenseError && [403].includes(e.status)) {
      // license revoked/expired server-side -> block the app now
    }
    // network error -> keep running on the cached token until it ages out
  }
}
```

`state` meaning: `ok` → run normally · `grace` → run + show "license needs to reconnect"
banner · `invalid` → block, require a key.

## POS-DUALSCREEN flow

- **Server role**: same as above but `role: "server"`, and each heartbeat also sends the
  live Terminal list from `dualscreen-server-gate.ts` (`activeTerminals()`).
- **Terminal role**: no license client at all. Add a `machineId` (uuid, once) to the
  existing `%APPDATA%\pos-dualscreen\node-config.json`, POST it to the Server's
  `POST /api/terminal/register` on launch + every 60 s, and show a "seats full" screen
  on a 403 instead of loading `http://<serverHost>:<serverPort>`.
- Add the middleware gate from `dualscreen-server-gate.ts` to the Server's
  `src/middleware.ts` so an invalid Server license blanks every screen at once.
