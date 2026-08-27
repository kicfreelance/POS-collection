import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

if (!env.databaseUrl && process.env.NODE_ENV !== "production") {
  // Non-fatal at import time so `next build` works without a database.
  console.warn("[db] DATABASE_URL is not set");
}

const globalForDb = globalThis as unknown as { __licensePool?: Pool };

const pool =
  globalForDb.__licensePool ??
  new Pool({
    connectionString: env.databaseUrl,
    ssl: env.databaseSsl === "require" ? { rejectUnauthorized: false } : false,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__licensePool = pool;
}

export const db = drizzle(pool, { schema });
export { pool };
