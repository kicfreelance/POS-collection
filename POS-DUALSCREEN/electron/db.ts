import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type EmbeddedPostgres from "embedded-postgres";

let instance: EmbeddedPostgres | null = null;

// embedded-postgres ships as an ESM-only package; load it at runtime via
// dynamic import() so this file can stay CommonJS like the rest of the
// Electron main process.
async function loadEmbeddedPostgres(): Promise<typeof EmbeddedPostgres> {
  const mod = await import("embedded-postgres");
  return mod.default;
}

function getDataDir(): string {
  // Dev: keep data next to the project so it's easy to inspect or wipe.
  // Packaged: use Electron's per-user data directory.
  if (!app.isPackaged) {
    return path.join(app.getAppPath(), ".pgdata");
  }
  return path.join(app.getPath("userData"), "pgdata");
}

export async function startEmbeddedPostgres(): Promise<void> {
  const port = Number(process.env.POS_DB_PORT ?? 54329);
  const user = process.env.POS_DB_USER ?? "pos";
  const password = process.env.POS_DB_PASSWORD ?? "pos_dev_password";
  const database = process.env.POS_DB_NAME ?? "pos";
  const databaseDir = getDataDir();

  const isFirstRun = !fs.existsSync(path.join(databaseDir, "PG_VERSION"));

  const EmbeddedPostgresCtor = await loadEmbeddedPostgres();
  instance = new EmbeddedPostgresCtor({
    databaseDir,
    port,
    user,
    password,
    authMethod: "password",
    persistent: true,
  });

  if (isFirstRun) {
    await instance.initialise();
  }

  await instance.start();

  // Not gated on isFirstRun: if a previous launch initialised the cluster but
  // was interrupted (e.g. port conflict) before the app database was created,
  // isFirstRun would be false on every later run yet the database still
  // wouldn't exist. Idempotently ensure it's there instead.
  try {
    await instance.createDatabase(database);
  } catch (error) {
    const alreadyExists =
      error instanceof Error && /already exists/i.test(error.message);
    if (!alreadyExists) throw error;
  }
}

export async function stopEmbeddedPostgres(): Promise<void> {
  if (instance) {
    await instance.stop();
    instance = null;
  }
}
