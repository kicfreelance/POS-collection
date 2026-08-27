import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const schema = await pool.query(
      "SELECT value FROM system_info WHERE key = $1",
      ["schema_version"],
    );
    const version = await pool.query("SELECT version() AS pg_version");

    return NextResponse.json({
      ok: true,
      schemaVersion: schema.rows[0]?.value ?? null,
      postgresVersion: version.rows[0]?.pg_version ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
