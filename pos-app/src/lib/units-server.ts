import { pool } from "@/lib/db";

export interface UnitOption {
  code: string;
  name: string;
  category: "count" | "weight" | "volume" | "length";
}

export interface SubUnitInfo {
  subUnit: string;
  subUnitName: string;
  factor: number;
}

export async function getUnits(): Promise<UnitOption[]> {
  const { rows } = await pool.query<UnitOption>(
    "SELECT code, name, category FROM units ORDER BY category, code",
  );
  return rows;
}

export async function getSubUnit(baseUnit: string): Promise<SubUnitInfo | null> {
  const { rows } = await pool.query<{ sub_unit: string; factor: string; name: string }>(
    `SELECT uc.sub_unit, uc.factor, u.name
     FROM unit_conversions uc
     JOIN units u ON u.code = uc.sub_unit
     WHERE uc.base_unit = $1`,
    [baseUnit],
  );
  if (!rows[0]) return null;
  return {
    subUnit: rows[0].sub_unit,
    subUnitName: rows[0].name,
    factor: Number(rows[0].factor),
  };
}
