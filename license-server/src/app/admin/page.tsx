import { desc } from "drizzle-orm";
import { db } from "@/db";
import { licenses } from "@/db/schema";
import { createLicense, releaseBind, setStatus } from "./actions";

export const dynamic = "force-dynamic";

const ACTIVE_WINDOW_MS = 3 * 60_000;

export default async function AdminPage() {
  let rows: Awaited<ReturnType<typeof loadLicenses>> = [];
  let dbError: string | null = null;
  try {
    rows = await loadLicenses();
  } catch (e) {
    dbError = String(e);
  }

  return (
    <main style={{ maxWidth: 1180, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>License Server</h1>

      {dbError && (
        <p style={{ color: "#b00" }}>
          Database not reachable — check <code>DATABASE_URL</code> and run{" "}
          <code>npm run db:migrate</code>. <br />
          <small>{dbError}</small>
        </p>
      )}

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 16,
          margin: "1rem 0",
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Mint a license</h2>
        <form
          action={createLicense}
          style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, 1fr)" }}
        >
          <label style={{ display: "grid", gap: 4 }}>
            Product
            <select name="product" defaultValue="pos-standard">
              <option value="pos-standard">pos-standard (single machine)</option>
              <option value="pos-dualscreen">pos-dualscreen (server + terminals)</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            Seat limit (dual-screen terminals)
            <input name="seatLimit" type="number" min={1} defaultValue={3} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            Edition
            <input name="edition" defaultValue="standard" />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            Expires at (blank = perpetual)
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
          <label style={{ display: "grid", gap: 4, gridColumn: "1 / -1" }}>
            Notes
            <input name="notes" />
          </label>
          <button type="submit" style={{ gridColumn: "1 / -1" }}>
            Create license
          </button>
        </form>
      </section>

      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Product</th>
            <th>Seats</th>
            <th>Status</th>
            <th>Bound to</th>
            <th>Seats in use</th>
            <th>Last heartbeat</th>
            <th>Expires</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const act = l.activations[0];
            const hb = act?.lastHeartbeatAt ? new Date(act.lastHeartbeatAt) : null;
            const online = hb ? Date.now() - hb.getTime() < ACTIVE_WINDOW_MS : false;
            return (
              <tr key={l.id}>
                <td>
                  <code>{l.key}</code>
                  {l.customerName ? <div style={{ color: "#666" }}>{l.customerName}</div> : null}
                </td>
                <td>{l.product}</td>
                <td>{l.seatLimit}</td>
                <td>
                  <span
                    style={{
                      color:
                        l.status === "active" ? "#087443" : l.status === "revoked" ? "#b00" : "#a60",
                    }}
                  >
                    {l.status}
                  </span>
                </td>
                <td>
                  {l.boundFingerprint ? (
                    <code title={l.boundFingerprint}>{l.boundFingerprint.slice(0, 12)}…</code>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {act ? `${act.activeTerminals} / ${l.seatLimit}` : "—"}
                  {act && act.activeTerminals > l.seatLimit ? (
                    <strong style={{ color: "#b00" }}> over</strong>
                  ) : null}
                </td>
                <td>
                  {hb ? (
                    <span style={{ color: online ? "#087443" : "#999" }}>
                      {online ? "online" : hb.toISOString().slice(0, 16).replace("T", " ")}
                    </span>
                  ) : (
                    "never"
                  )}
                </td>
                <td>{l.expiresAt ? new Date(l.expiresAt).toISOString().slice(0, 10) : "perpetual"}</td>
                <td>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <form action={setStatus}>
                      <input type="hidden" name="id" value={l.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={l.status === "revoked" ? "active" : "revoked"}
                      />
                      <button className="secondary">
                        {l.status === "revoked" ? "Un-revoke" : "Revoke"}
                      </button>
                    </form>
                    <form action={releaseBind}>
                      <input type="hidden" name="id" value={l.id} />
                      <button className="secondary">Release bind</button>
                    </form>
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && !dbError && (
            <tr>
              <td colSpan={9} style={{ color: "#777" }}>
                No licenses yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

function loadLicenses() {
  return db.query.licenses.findMany({
    orderBy: [desc(licenses.createdAt)],
    with: { activations: true },
  });
}
