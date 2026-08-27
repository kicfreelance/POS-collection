# Licensing — threat model

Straight answer to "make sure no one can crack it": a client-side licence check
in a shipped app can never be *uncrackable*. Every offline-capable scheme
(JetBrains, Adobe, Windows itself) eventually gets patched. The realistic goal is
to make casual piracy not worth the effort and keep honest customers unbothered.
Here is exactly what this design does and does not stop.

## What is genuinely hard to defeat

| Attack | Why it fails |
|---|---|
| **Keygen** (offline key generator) | The client holds only the Ed25519 **public** key. Minting or extending a licence needs the **private** key, which exists only in the licence-server environment on Railway. |
| **Fake / MITM licence server** | Every entitlement token is signed by the private key. A spoofed server can return JSON, but `verifyToken()` rejects anything without a valid signature. No cert pinning needed. |
| **Copy the licence file to another PC** | The token embeds the machine `fingerprint`; `evaluate()` fails if it doesn't match. The local cache is also HMAC-tagged with a key derived from that fingerprint, so it can't be moved or hand-edited. |
| **Edit the cached token** (extend expiry, flip status) | Any edit breaks the Ed25519 signature → treated as no licence. |
| **System clock rollback** (freeze an expired offline licence) | The cache stores `seenTime`, a monotonic high-water mark advanced on every launch and every server contact. If the wall clock is more than 24 h behind it, the licence drops to "grace" at best and then expires on schedule. |
| **Replay someone else's activation response** | The token is bound to the requester's fingerprint. Replaying another machine's token → `wrong_machine`. |
| **Share one key with many installs** | Key is bound to one machine (`bound_fingerprint`); moves are capped (`maxTransfers`, default 3); the server logs every activation/transfer and the dual-screen Server reports its live seat count on each heartbeat, so abuse is visible in `/admin`. |
| **Run more dual-screen terminals than paid for** | The Server counts connected terminals in-process and refuses registrations past `seatLimit`; terminals never get their own token. |

## What still works for a determined attacker

- **Patching the app's own JavaScript** to skip the check. The licence code ships
  as readable JS in the Electron bundle. Someone who reverse-engineers a build
  can NOP the gate.
  - Cost to them: do it on **every** install, and **redo it after every app
    update** (the patched files are overwritten).
  - Raise the bar further, in rough order of value:
    1. `asar` archive + `asintegrity` (Electron fuse) so casual file edits break the app.
    2. Ship `electron/license-client.js` + `license-gate.js` as **V8 bytecode**
       (`bytenode`) instead of plain JS.
    3. Move `verifyToken` + fingerprint into a **native N-API addon** (Rust
       `napi-rs`), so bypassing it means patching machine code, per ABI, per arch.
    4. Server-side behavioural checks: alert on a licence that never heartbeats,
       or that heartbeats from many unrelated IP ranges.

None of these are implemented yet; the current build stops everything except JS
patching.

## Operational notes

- **Rotate the signing key** = re-run `npm run keypair`, set the new
  `LICENSE_SIGNING_PRIVATE_KEY`/`_PUBLIC_KEY` on Railway, ship a new app build
  with the new `LICENSE_PUBLIC_KEY_B64`. Old tokens stop verifying, so do this
  only for a compromise.
- **Token lifetime** (`LICENSE_TOKEN_TTL_DAYS`, default 30) + client
  `OFFLINE_GRACE_DAYS` (5) = how long a revoked licence keeps working offline.
  Shorten for tighter control, lengthen for customers with poor connectivity.
- **Revocation** takes effect at the revoked machine's next heartbeat (≤12 h),
  or immediately on its next launch if it's online.
