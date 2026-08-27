import { desc } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { licenses } from "@/db/schema";
import { checkAdminBearer, json, logEvent } from "@/lib/http";
import { generateLicenseKey } from "@/lib/keygen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/licenses  — list every license with its activations. */
export async function GET(req: NextRequest) {
  if (!checkAdminBearer(req)) return json({ error: "unauthorized" }, 401);
  const rows = await db.query.licenses.findMany({
    orderBy: [desc(licenses.createdAt)],
    with: { activations: true, terminals: true },
  });
  return json({ licenses: rows });
}

/**
 * POST /api/v1/licenses  — mint a new key.
 * body: { product, edition?, seatLimit?, customerName?, customerEmail?,
 *         maxActivations?, expiresAt?, notes? }
 */
export async function POST(req: NextRequest) {
  if (!checkAdminBearer(req)) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const product =
    body.product === "pos-dualscreen"
      ? "pos-dualscreen"
      : body.product === "pos-standard"
        ? "pos-standard"
        : null;
  if (!product) {
    return json({ error: "product must be 'pos-standard' or 'pos-dualscreen'" }, 400);
  }

  const seatLimit =
    product === "pos-dualscreen"
      ? Math.max(1, Math.trunc(Number(body.seatLimit ?? 3)) || 3)
      : 1;

  const [row] = await db
    .insert(licenses)
    .values({
      key: generateLicenseKey(product),
      product,
      edition: body.edition ? String(body.edition) : "standard",
      seatLimit,
      customerName: (body.customerName as string) ?? null,
      customerEmail: (body.customerEmail as string) ?? null,
      maxActivations:
        body.maxActivations != null ? Math.max(1, Math.trunc(Number(body.maxActivations)) || 1) : 1,
      expiresAt: body.expiresAt ? new Date(body.expiresAt as string) : null,
      notes: (body.notes as string) ?? null,
    })
    .returning();

  await logEvent({ licenseId: row!.id, type: "admin", detail: { action: "mint", product } });
  return json({ license: row }, 201);
}
