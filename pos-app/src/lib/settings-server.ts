import { pool } from "@/lib/db";
import type { ReceiptFontSize, ReceiptPaperWidth, ReceiptTemplate } from "@/lib/receipt/types";

export interface BusinessSettings {
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
  labelPrinterName: string | null;
  receiptTemplate: ReceiptTemplate;
  receiptPaperWidth: ReceiptPaperWidth;
  receiptFontSize: ReceiptFontSize;
  receiptShowLogo: boolean;
  receiptShowTaxId: boolean;
  receiptShowCashier: boolean;
  receiptShowBarcode: boolean;
  receiptAutoPrint: boolean;
}

interface SettingsRow {
  business_name: string;
  logo_url: string | null;
  address: string | null;
  tax_id: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  tax_inclusive_pricing: boolean;
  receipt_header: string | null;
  receipt_footer: string | null;
  currency_code: string;
  currency_symbol: string;
  locale: string;
  costing_method: "weighted_average" | "batch_fifo";
  business_type: "retail" | "restaurant";
  receipt_printer_name: string | null;
  kot_printer_name: string | null;
  label_printer_name: string | null;
  receipt_template: ReceiptTemplate;
  receipt_paper_width: ReceiptPaperWidth;
  receipt_font_size: ReceiptFontSize;
  receipt_show_logo: boolean;
  receipt_show_tax_id: boolean;
  receipt_show_cashier: boolean;
  receipt_show_barcode: boolean;
  receipt_auto_print: boolean;
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const { rows } = await pool.query<SettingsRow>(`SELECT * FROM business_settings WHERE id = true`);
  const row = rows[0];
  return {
    businessName: row.business_name,
    logoUrl: row.logo_url,
    address: row.address,
    taxId: row.tax_id,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    taxInclusivePricing: row.tax_inclusive_pricing,
    receiptHeader: row.receipt_header,
    receiptFooter: row.receipt_footer,
    currencyCode: row.currency_code,
    currencySymbol: row.currency_symbol,
    locale: row.locale,
    costingMethod: row.costing_method,
    businessType: row.business_type,
    receiptPrinterName: row.receipt_printer_name,
    kotPrinterName: row.kot_printer_name,
    labelPrinterName: row.label_printer_name,
    receiptTemplate: row.receipt_template,
    receiptPaperWidth: row.receipt_paper_width,
    receiptFontSize: row.receipt_font_size,
    receiptShowLogo: row.receipt_show_logo,
    receiptShowTaxId: row.receipt_show_tax_id,
    receiptShowCashier: row.receipt_show_cashier,
    receiptShowBarcode: row.receipt_show_barcode,
    receiptAutoPrint: row.receipt_auto_print,
  };
}
