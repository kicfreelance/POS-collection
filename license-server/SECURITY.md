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
| **System clock rollback** (time-limited licences only) | The cache stores `seenTime`, a monotonic high-water mark advanced on every launch. Wall clock >24 h behind it → "grace" at best, then expires on schedule. Perpetual licences have no expiry so there is nothing to roll back to. |
| **Replay someone else's activation response** | The token is bound to the requester's fingerprint. Replaying another machine's token → `wrong_machine`. |
| **"My PC died, activate me on a new one" — repeatedly** | Activation is permanent and **counted**. A new machine consumes one of `maxActivations` slots (default 1); once used up the server returns `activation_limit_reached` and only the vendor can raise the cap or delete a machine in `/admin`. Every attempt — including refused ones — is logged and shown per-licence, so "this key = 5 machines in 2 months" is visible. There is no self-service transfer. |
| **Reinstall Windows / the app to look like a new machine** | Same `MachineGuid` → same fingerprint → recognised as the same machine → free, no slot consumed. Only a genuinely different PC costs a slot. |
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
- **Perpetual vs time-limited.** A licence minted with no expiry date is
  **perpetual**: the token carries `perpetual: true`, never expires, and works
  offline forever after one activation. `LICENSE_TOKEN_TTL_DAYS` (30) +
  `OFFLINE_GRACE_DAYS` (5) only apply to licences given an expiry date.
- **Revocation reaches a machine only if it comes back online.** With
  perpetual + offline-forever, an already-activated machine that never
  reconnects cannot be stopped from the server — this is the accepted trade-off.
  Your controls all act at activation time: `maxActivations`, `activationLocked`,
  per-machine `block`, and deleting a machine row.
- **When a customer really did replace a PC:** in `/admin`, open the licence,
  check the machine list + refused-attempt log, then either **Grant +1** (or take
  payment first) or **Delete** the dead machine's row to free its slot.
- **Rotate the signing key** = re-run `npm run keypair`, set the new
  `LICENSE_SIGNING_PRIVATE_KEY`/`_PUBLIC_KEY` on Railway, ship a new app build
  with the new `LICENSE_PUBLIC_KEY_B64`. Old tokens stop verifying — compromise only.
