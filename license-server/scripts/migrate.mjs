// Plain-JS migration runner so it works on Railway with production-only deps
// (drizzle-orm + pg are runtime dependencies; tsx / drizzle-kit are not).
try {
  await import("dotenv/config"); // present locally; on Railway env is injected
} catch {
  /* ignore — dotenv is a dev dependency */
}

const { drizzle } = await import("drizzle-orm/node-postgres");
const { migrate } = await import("drizzle-orm/node-postgres/migrator");
const { default: pg } = await import("pg");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const pool = new pg.Pool({
  connectionString: url,
  ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: false } : false,
});

const db = drizzle(pool);
await migrate(db, { migrationsFolder: "./drizzle" });
await pool.end();
console.log("migrations applied");
