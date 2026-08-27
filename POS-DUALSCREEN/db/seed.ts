import fs from "node:fs";
import { Client } from "pg";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { PERMISSIONS, type PermissionKey } from "../src/lib/auth/permissions";

const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  Cashier: [
    "products.view",
    "sales.create",
    "discounts.apply",
    "customers.view",
    "customers.manage",
    "shifts.open_close",
  ],
  "Inventory Manager": [
    "products.view",
    "products.manage",
    "inventory.view",
    "inventory.adjust",
    "grn.manage",
    "grn.return",
    "reports.view",
  ],
  "Shift Supervisor": [
    "products.view",
    "sales.create",
    "sales.void",
    "sales.refund",
    "discounts.apply",
    "discounts.override_limit",
    "customers.view",
    "customers.manage",
    "customers.manage_credit",
    "shifts.open_close",
    "shifts.override_cash",
    "reports.view",
  ],
};

interface RoleRow {
  id: string;
  name: string;
}

const UNITS: { code: string; name: string; category: "count" | "weight" | "volume" | "length" }[] = [
  { code: "pcs", name: "Pieces", category: "count" },
  { code: "kg", name: "Kilogram", category: "weight" },
  { code: "g", name: "Gram", category: "weight" },
  { code: "L", name: "Litre", category: "volume" },
  { code: "ml", name: "Millilitre", category: "volume" },
  { code: "m", name: "Metre", category: "length" },
  { code: "mm", name: "Millimetre", category: "length" },
];

const UNIT_CONVERSIONS: { base: string; sub: string; factor: number }[] = [
  { base: "kg", sub: "g", factor: 1000 },
  { base: "L", sub: "ml", factor: 1000 },
  { base: "m", sub: "mm", factor: 1000 },
];

async function upsertRole(
  client: Client,
  name: string,
  opts: { isSuperAdmin: boolean; isSystem: boolean },
): Promise<RoleRow> {
  const { rows } = await client.query<RoleRow>(
    `INSERT INTO roles (name, is_super_admin, is_system) VALUES ($1, $2, $3)
     ON CONFLICT (name) DO UPDATE SET is_system = EXCLUDED.is_system
     RETURNING id, name`,
    [name, opts.isSuperAdmin, opts.isSystem],
  );
  return rows[0];
}

export async function seedDatabase(): Promise<{ createdAdminPin: string } | null> {
  let createdAdminPin: string | null = null;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    for (const permission of PERMISSIONS) {
      await client.query(
        `INSERT INTO permissions (key, module, description) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET module = EXCLUDED.module, description = EXCLUDED.description`,
        [permission.key, permission.module, permission.description],
      );
    }

    const superAdminRole = await upsertRole(client, "Super Admin", {
      isSuperAdmin: true,
      isSystem: true,
    });

    for (const [roleName, permissionKeys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const role = await upsertRole(client, roleName, { isSuperAdmin: false, isSystem: false });
      for (const key of permissionKeys) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [role.id, key],
        );
      }
    }

    const { rows: existingUsers } = await client.query("SELECT id FROM users LIMIT 1");
    if (existingUsers.length === 0) {
      const pin = crypto.randomInt(100000, 999999).toString();
      const pinHash = await bcrypt.hash(pin, 10);
      await client.query(
        `INSERT INTO users (full_name, username, pin_hash, role_id) VALUES ($1, $2, $3, $4)`,
        ["Administrator", "admin", pinHash, superAdminRole.id],
      );
      createdAdminPin = pin;

      console.log("============================================");
      console.log(" First-run setup: created default admin user");
      console.log(" Username: admin");
      console.log(` PIN:      ${pin}`);
      console.log(" Change this PIN after logging in.");
      console.log("============================================");

      // Persist the one-time PIN somewhere the operator can actually find it —
      // a packaged GUI app has no visible console. main.ts also shows it in a
      // dialog and sets POS_CRED_FILE to a path in the app's user-data dir.
      const credFile = process.env.POS_CRED_FILE;
      if (credFile) {
        try {
          fs.writeFileSync(
            credFile,
            `POS — first-run login\r\n\r\nUsername: admin\r\nPIN: ${pin}\r\n\r\n` +
              `Created ${new Date().toISOString()}. Change this PIN after logging in.\r\n` +
              `This file is safe to delete once you have noted the PIN.\r\n`,
            "utf8",
          );
        } catch {
          /* best effort */
        }
      }
    }

    for (const unit of UNITS) {
      await client.query(
        `INSERT INTO units (code, name, category) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category`,
        [unit.code, unit.name, unit.category],
      );
    }

    for (const conversion of UNIT_CONVERSIONS) {
      await client.query(
        `INSERT INTO unit_conversions (base_unit, sub_unit, factor) VALUES ($1, $2, $3)
         ON CONFLICT (base_unit, sub_unit) DO UPDATE SET factor = EXCLUDED.factor`,
        [conversion.base, conversion.sub, conversion.factor],
      );
    }
  } finally {
    await client.end();
  }

  return createdAdminPin ? { createdAdminPin } : null;
}
