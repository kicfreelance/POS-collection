import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * A license key sold to a customer. Everything the key "means" lives here —
 * the key string itself is an opaque random token.
 *
 * `boundFingerprint` locks the key to a single installation (the standalone
 * machine, or the dual-screen SERVER machine). Terminals never appear here.
 */
export const licenses = pgTable("licenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),

  // Which product this key unlocks.
  product: text("product", {
    enum: ["pos-standard", "pos-dualscreen"],
  }).notNull(),
  edition: text("edition").notNull().default("standard"),

  // Dual-screen: max number of concurrently-connected Terminal screens the
  // Server will allow. Standalone: always 1.
  seatLimit: integer("seat_limit").notNull().default(1),

  customerName: text("customer_name"),
  customerEmail: text("customer_email"),

  status: text("status", {
    enum: ["active", "suspended", "revoked"],
  })
    .notNull()
    .default("active"),

  // Set on first activation; cleared by a self-service deactivate or an admin
  // "release bind". A different fingerprint can only take over via a transfer.
  boundFingerprint: text("bound_fingerprint"),
  boundAt: timestamp("bound_at", { withTimezone: true }),

  activationCount: integer("activation_count").notNull().default(0),
  maxTransfers: integer("max_transfers").notNull().default(3),
  transfersUsed: integer("transfers_used").notNull().default(0),

  // null => perpetual license.
  expiresAt: timestamp("expires_at", { withTimezone: true }),

  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per installation that has activated the license. In practice there is
 * exactly one active row per license (the bound machine); older rows are pruned
 * on transfer. `activeTerminals` is the seat count the Server self-reports on
 * each heartbeat.
 */
export const activations = pgTable(
  "activations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    licenseId: uuid("license_id")
      .notNull()
      .references(() => licenses.id, { onDelete: "cascade" }),

    fingerprint: text("fingerprint").notNull(),
    hostname: text("hostname"),
    role: text("role", { enum: ["standalone", "server"] })
      .notNull()
      .default("standalone"),
    appVersion: text("app_version"),
    os: text("os"),

    // Bumped by an admin to force every cached token to be re-issued.
    tokenVersion: integer("token_version").notNull().default(1),

    // Seats currently in use, as last reported by the Server's heartbeat.
    activeTerminals: integer("active_terminals").notNull().default(0),

    revoked: boolean("revoked").notNull().default(false),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("activations_license_fingerprint_uq").on(t.licenseId, t.fingerprint),
    index("activations_license_idx").on(t.licenseId),
  ],
);

/**
 * Optional per-Terminal telemetry, pushed up by the Server on each heartbeat.
 * The Server also enforces the seat limit locally; this table just gives the
 * admin dashboard visibility into which screens are connected.
 */
export const terminalRegistrations = pgTable(
  "terminal_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    licenseId: uuid("license_id")
      .notNull()
      .references(() => licenses.id, { onDelete: "cascade" }),
    activationId: uuid("activation_id")
      .notNull()
      .references(() => activations.id, { onDelete: "cascade" }),

    machineId: text("machine_id").notNull(),
    hostname: text("hostname"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("terminal_reg_activation_machine_uq").on(t.activationId, t.machineId),
    index("terminal_reg_license_idx").on(t.licenseId),
  ],
);

/** Append-only audit trail. */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    licenseId: uuid("license_id").references(() => licenses.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(), // activate | heartbeat | deactivate | transfer | reject | admin
    fingerprint: text("fingerprint"),
    ip: text("ip"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("events_license_idx").on(t.licenseId),
    index("events_created_idx").on(t.createdAt),
  ],
);

export const licensesRelations = relations(licenses, ({ many }) => ({
  activations: many(activations),
  terminals: many(terminalRegistrations),
}));

export const activationsRelations = relations(activations, ({ one, many }) => ({
  license: one(licenses, {
    fields: [activations.licenseId],
    references: [licenses.id],
  }),
  terminals: many(terminalRegistrations),
}));

export const terminalRegistrationsRelations = relations(
  terminalRegistrations,
  ({ one }) => ({
    license: one(licenses, {
      fields: [terminalRegistrations.licenseId],
      references: [licenses.id],
    }),
    activation: one(activations, {
      fields: [terminalRegistrations.activationId],
      references: [activations.id],
    }),
  }),
);

export type License = typeof licenses.$inferSelect;
export type Activation = typeof activations.$inferSelect;
export type TerminalRegistration = typeof terminalRegistrations.$inferSelect;
