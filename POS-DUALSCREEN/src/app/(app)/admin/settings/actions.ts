"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/rbac";

async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || !user.isSuperAdmin) {
    throw new Error("Only Super Admin can manage business settings");
  }
  return user;
}

export interface BusinessSettingsInput {
  businessName: string;
  logoUrl: string | null;
  address: string | null;
  taxId: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  taxInclusivePricing: boolean;
  receiptHeader: string | null;
  receiptFooter: string | null;
  currencyCode: string;
  currencySymbol: string;
  locale: string;
  costingMethod: "weighted_average" | "batch_fifo";
  businessType: "retail" | "restaurant";
  receiptPrinterName: string | null;
  kotPrinterName: string | null;
}

export async function updateBusinessSettings(input: BusinessSettingsInput): Promise<void> {
  await requireSuperAdmin();
  if (!input.businessName.trim()) throw new Error("Business name is required");

  await pool.query(
    `UPDATE business_settings SET
       business_name=$1, logo_url=$2, address=$3, tax_id=$4, contact_phone=$5, contact_email=$6,
       tax_inclusive_pricing=$7, receipt_header=$8, receipt_footer=$9, currency_code=$10,
       currency_symbol=$11, locale=$12, costing_method=$13, business_type=$14,
       receipt_printer_name=$15, kot_printer_name=$16, updated_at=now()
     WHERE id = true`,
    [
      input.businessName.trim(),
      input.logoUrl || null,
      input.address || null,
      input.taxId || null,
      input.contactPhone || null,
      input.contactEmail || null,
      input.taxInclusivePricing,
      input.receiptHeader || null,
      input.receiptFooter || null,
      input.currencyCode.trim() || "USD",
      input.currencySymbol.trim() || "$",
      input.locale.trim() || "en-US",
      input.costingMethod,
      input.businessType,
      input.receiptPrinterName || null,
      input.kotPrinterName || null,
    ],
  );

  revalidatePath("/admin/settings");
  revalidatePath("/");
}

export interface RestaurantTableRow {
  id: string;
  name: string;
  isActive: boolean;
}

export async function listRestaurantTables(): Promise<RestaurantTableRow[]> {
  await requireSuperAdmin();
  const { rows } = await pool.query<{ id: string; name: string; is_active: boolean }>(
    `SELECT id, name, is_active FROM restaurant_tables ORDER BY name`,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, isActive: r.is_active }));
}

export async function createRestaurantTable(name: string): Promise<void> {
  await requireSuperAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Table name is required");
  await pool.query(
    `INSERT INTO restaurant_tables (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET is_active = true`,
    [trimmed],
  );
  revalidatePath("/admin/settings");
  revalidatePath("/");
}

export async function setRestaurantTableActive(tableId: string, isActive: boolean): Promise<void> {
  await requireSuperAdmin();
  await pool.query(`UPDATE restaurant_tables SET is_active=$1 WHERE id=$2`, [isActive, tableId]);
  revalidatePath("/admin/settings");
  revalidatePath("/");
}

export interface KitchenStationRow {
  id: string;
  name: string;
  printerName: string | null;
  isActive: boolean;
}

export async function listKitchenStations(): Promise<KitchenStationRow[]> {
  await requireSuperAdmin();
  const { rows } = await pool.query<{ id: string; name: string; printer_name: string | null; is_active: boolean }>(
    `SELECT id, name, printer_name, is_active FROM kitchen_stations ORDER BY name`,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, printerName: r.printer_name, isActive: r.is_active }));
}

export async function createKitchenStation(name: string): Promise<void> {
  await requireSuperAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Station name is required");
  await pool.query(
    `INSERT INTO kitchen_stations (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET is_active = true`,
    [trimmed],
  );
  revalidatePath("/admin/settings");
}

export async function setKitchenStationPrinter(stationId: string, printerName: string | null): Promise<void> {
  await requireSuperAdmin();
  await pool.query(`UPDATE kitchen_stations SET printer_name=$1 WHERE id=$2`, [printerName, stationId]);
  revalidatePath("/admin/settings");
}

export async function setKitchenStationActive(stationId: string, isActive: boolean): Promise<void> {
  await requireSuperAdmin();
  await pool.query(`UPDATE kitchen_stations SET is_active=$1 WHERE id=$2`, [isActive, stationId]);
  revalidatePath("/admin/settings");
}

export interface CategoryStationRow {
  id: string;
  name: string;
  stationId: string | null;
}

export async function listCategoriesWithStations(): Promise<CategoryStationRow[]> {
  await requireSuperAdmin();
  const { rows } = await pool.query<{ id: string; name: string; station_id: string | null }>(
    `SELECT id, name, station_id FROM categories ORDER BY name`,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, stationId: r.station_id }));
}

export async function setCategoryStation(categoryId: string, stationId: string | null): Promise<void> {
  await requireSuperAdmin();
  await pool.query(`UPDATE categories SET station_id=$1 WHERE id=$2`, [stationId, categoryId]);
  revalidatePath("/admin/settings");
  revalidatePath("/");
}

export interface ProductStationRow {
  id: string;
  name: string;
  categoryName: string | null;
  categoryStationId: string | null;
  stationId: string | null;
}

export async function listProductsWithStations(): Promise<ProductStationRow[]> {
  await requireSuperAdmin();
  const { rows } = await pool.query<{
    id: string;
    name: string;
    category_name: string | null;
    category_station_id: string | null;
    station_id: string | null;
  }>(
    `SELECT p.id, p.name, c.name AS category_name, c.station_id AS category_station_id, p.station_id
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = true
     ORDER BY p.name`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    categoryName: r.category_name,
    categoryStationId: r.category_station_id,
    stationId: r.station_id,
  }));
}

export async function setProductStation(productId: string, stationId: string | null): Promise<void> {
  await requireSuperAdmin();
  await pool.query(`UPDATE products SET station_id=$1 WHERE id=$2`, [stationId, productId]);
  revalidatePath("/admin/settings");
  revalidatePath("/");
}
