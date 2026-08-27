import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const stationId = request.nextUrl.searchParams.get("station");

  if (type === "receipt") {
    const { rows } = await pool.query<{ receipt_printer_name: string | null }>(
      `SELECT receipt_printer_name FROM business_settings WHERE id = true`,
    );
    return NextResponse.json({ printerName: rows[0]?.receipt_printer_name ?? null });
  }

  if (type === "kot") {
    if (stationId) {
      const { rows } = await pool.query<{ printer_name: string | null }>(
        `SELECT printer_name FROM kitchen_stations WHERE id = $1`,
        [stationId],
      );
      if (rows[0]) {
        return NextResponse.json({ printerName: rows[0].printer_name });
      }
    }
    const { rows } = await pool.query<{ kot_printer_name: string | null }>(
      `SELECT kot_printer_name FROM business_settings WHERE id = true`,
    );
    return NextResponse.json({ printerName: rows[0]?.kot_printer_name ?? null });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
