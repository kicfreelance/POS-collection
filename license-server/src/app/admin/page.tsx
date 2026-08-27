import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { activations, events, licenses } from "@/db/schema";
import {
  clearSuspectedAbuse,
  createLicense,
  deleteMachine,
  grantActivation,
  setMachineBlocked,
  setStatus,
  toggleActivationLock,
} from "./actions";

export const dynamic = "force-dynamic";

const ONLINE_MS = 15 * 60_000;

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 16).replace("T", " ");
}

export default async function AdminPage() {
  let rows: Awaited<ReturnType<typeof loadLicenses>> = [];
  let rejects: Awaited<ReturnType<typeof loadRejects>> = [];
  let dbError: string | null = null;
  try {
    rows = await loadLicenses();
    rejects = await loadRejects();
  } catch (e) {
    dbError = String(e);
  }

  const rejectsByLicense = new Map<string, typeof rejects>();
  for (const r of rejects) {
    if (!r.licenseId) continue;
    const list = rejectsByLicense.get(r.licenseId) ?? [];
    list.push(r);
    rejectsByLicense.set(r.licenseId, list);
  }

  const flaggedCount = rows.filter((l) => l.suspectedAbuse).length;

  return (
    <main style={{ maxWidth: 1000, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>License Server</h1>

      {flaggedCount > 0 && (
        <p
          style={{
            background: "#fdecec",
            color: "#a1180f",
            border: "1px solid #f3b4ae",
            borderRadius: 8,
            padding: "10px 14px",
            fontWeight: 600,
          }}
        >
          ⚠ {flaggedCount} licence(s) flagged for suspected abuse — a removed or blocked
          machine has contacted the server, or a key is being hammered. See the red cards below.
        </p>
      )}

      {dbError && (
        <p style={{ color: "#b00" }}>
          Database not reachable — check <code>DATABASE_URL</code> and run{" "}
          <code>npm run db:migrate</code>.<br />
          <small>{dbError}</small>
        </p>
      )}

      <section
        style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, margin: "1rem 0", background: "#fff" }}
      >
        <h2 style={{ marginTop: 0 }}>Mint a license</h2>
        <form action={createLicense} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, 1fr)" }}>
          <label style={{ display: "grid", gap: 4 }}>
            Product
            <select name="product" defaultValue="pos-standard">
              <option value="pos-standard">pos-standard (single machine)</option>
              <option value="pos-dualscreen">pos-dualscreen (server + terminals)</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            Max activations (distinct machines, lifetime)
            <input name="maxActivations" type="number" min={1} defaultValue={1} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            Seat limit (dual-screen terminals)
            <input name="seatLimit" type="number" min={1} defaultValue={3} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            Expires at (blank = perpetual, offline forever)
            <input name="expiresAt" type="date" />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            Customer name
            <input name="customerName" />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            Customer email
            <input name="customerEmail" type="email" />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            Edition
            <input name="edition" defaultValue="standard" />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            Notes
            <input name="notes" />
          </label>
          <button type="submit" style={{ gridColumn: "1 / -1" }}>Create license</button>
        </form>
      </section>

      {rows.length === 0 && !dbError && <p style={{ color: "#777" }}>No licenses yet.</p>}

      {rows.map((l) => {
        const used = l.activations.filter((a) => !a.blocked).length;
        const full = used >= l.maxActivations;
        const licRejects = rejectsByLicense.get(l.id) ?? [];
        return (
          <section
            key={l.id}
            style={{
              border: l.suspectedAbuse ? "2px solid #b00" : "1px solid #ddd",
              borderLeft: `4px solid ${l.status === "active" ? "#087443" : l.status === "revoked" ? "#b00" : "#a60"}`,
              borderRadius: 8,
              padding: 16,
              margin: "1rem 0",
              background: l.suspectedAbuse ? "#fff7f7" : "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <code style={{ fontSize: 15 }}>{l.key}</code>
                <div style={{ color: "#666", fontSize: 13 }}>
                  {l.product} · {l.edition} · {l.customerName || "no customer"}
                  {l.customerEmail ? ` · ${l.customerEmail}` : ""} ·{" "}
                  {l.expiresAt ? `expires ${new Date(l.expiresAt).toISOString().slice(0, 10)}` : "perpetual"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: full ? "#b00" : "#087443" }}>
                  {used} / {l.maxActivations} machines
                </span>
                <form action={grantActivation}>
                  <input type="hidden" name="id" value={l.id} />
                  <button className="secondary">Grant +1</button>
                </form>
                <form action={toggleActivationLock}>
                  <input type="hidden" name="id" value={l.id} />
                  <button className="secondary">
                    {l.activationLocked ? "Unlock activations" : "Lock activations"}
                  </button>
                </form>
                <form action={setStatus}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="status" value={l.status === "revoked" ? "active" : "revoked"} />
                  <button className="secondary">{l.status === "revoked" ? "Un-revoke" : "Revoke"}</button>
                </form>
              </div>
            </div>

            {l.suspectedAbuse && (
              <div
                style={{
                  background: "#fdecec",
                  border: "1px solid #f3b4ae",
                  borderRadius: 6,
                  padding: "8px 10px",
                  margin: "10px 0 0",
                  fontSize: 13,
                }}
              >
                <strong style={{ color: "#a1180f" }}>⚠ Suspected abuse</strong>
                {l.suspectedAbuseAt ? (
                  <span style={{ color: "#666" }}> · {fmt(l.suspectedAbuseAt)}</span>
                ) : null}
                <div style={{ color: "#a1180f", marginTop: 2 }}>{l.suspectedAbuseNote}</div>
                <form action={clearSuspectedAbuse} style={{ marginTop: 6 }}>
                  <input type="hidden" name="id" value={l.id} />
                  <button className="secondary">Clear flag</button>
                </form>
              </div>
            )}

            {l.activationLocked && (
              <p style={{ color: "#b00", margin: "8px 0 0", fontSize: 13 }}>
                🔒 Activation locked — no new machine can activate.
              </p>
            )}

            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Host</th>
                  <th>First seen</th>
                  <th>Last contact</th>
                  <th>Re-activs</th>
                  <th>IP</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {l.activations.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ color: "#999" }}>Not activated on any machine yet.</td>
                  </tr>
                )}
                {l.activations.map((a) => {
                  const online = a.lastHeartbeatAt
                    ? Date.now() - new Date(a.lastHeartbeatAt).getTime() < ONLINE_MS
                    : false;
                  return (
                    <tr key={a.id} style={{ opacity: a.blocked ? 0.5 : 1 }}>
                      <td>
                        <code title={a.fingerprint}>{a.fingerprint.slice(0, 12)}…</code>
                        {a.blocked && <strong style={{ color: "#b00" }}> blocked</strong>}
                        {a.revoked && !a.blocked && <span style={{ color: "#a60" }}> revoked</span>}
                        {a.role === "server" && <span style={{ color: "#666" }}> · server</span>}
                        {a.label ? <div style={{ color: "#666", fontSize: 12 }}>{a.label}</div> : null}
                      </td>
                      <td>{a.hostname || "—"}</td>
                      <td>{fmt(a.createdAt)}</td>
                      <td style={{ color: online ? "#087443" : undefined }}>
                        {online ? "online now" : fmt(a.lastHeartbeatAt)}
                      </td>
                      <td>{a.reactivations}</td>
                      <td style={{ fontSize: 12 }}>
                        {a.ipLast || a.ipFirst || "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <form action={setMachineBlocked}>
                            <input type="hidden" name="licenseId" value={l.id} />
                            <input type="hidden" name="machineId" value={a.id} />
                            <input type="hidden" name="blocked" value={a.blocked ? "false" : "true"} />
                            <button className="secondary">{a.blocked ? "Unblock" : "Block"}</button>
                          </form>
                          <form action={deleteMachine}>
                            <input type="hidden" name="licenseId" value={l.id} />
                            <input type="hidden" name="machineId" value={a.id} />
                            <button className="secondary" title="That old PC is really gone — frees a slot">
                              Delete
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {licRejects.length > 0 && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", color: "#a60" }}>
                  ⚠ {licRejects.length} refused activation / removed-machine check-in(s)
                </summary>
                <ul style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                  {licRejects.map((r) => (
                    <li key={r.id}>
                      {fmt(r.createdAt)} ·{" "}
                      {r.type === "zombie_heartbeat" ? "removed machine checked in" : "activation refused"} ·{" "}
                      {String((r.detail as Record<string, unknown>)?.reason ?? "?")} · fp{" "}
                      {r.fingerprint?.slice(0, 10)}… · ip {r.ip}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        );
      })}
    </main>
  );
}

function loadLicenses() {
  return db.query.licenses.findMany({
    orderBy: [desc(licenses.createdAt)],
    with: { activations: { orderBy: [desc(activations.createdAt)] } },
  });
}

function loadRejects() {
  return db.query.events.findMany({
    where: inArray(events.type, ["reject", "zombie_heartbeat"]),
    orderBy: [desc(events.createdAt)],
    limit: 200,
  });
}
