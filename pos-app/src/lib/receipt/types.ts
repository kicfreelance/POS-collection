export type ReceiptTemplate = "classic" | "compact" | "modern" | "detailed" | "minimal";
export type ReceiptPaperWidth = "58mm" | "80mm";
export type ReceiptFontSize = "small" | "medium" | "large";

export const RECEIPT_TEMPLATES: { value: ReceiptTemplate; label: string; blurb: string }[] = [
  { value: "classic", label: "Classic", blurb: "Centered header, dashed rules — the familiar look" },
  { value: "compact", label: "Compact", blurb: "Tight single-line items, saves paper" },
  { value: "modern", label: "Modern", blurb: "Bold name, hairline rules, inverted total bar" },
  { value: "detailed", label: "Detailed", blurb: "Per-line tax, SKU column, tax-ID block, sale barcode" },
  { value: "minimal", label: "Minimal", blurb: "Name, items, total, footer — nothing else" },
];

/** Presentation choices for a printed receipt. Persisted on business_settings. */
export interface ReceiptStyle {
  template: ReceiptTemplate;
  paperWidth: ReceiptPaperWidth;
  fontSize: ReceiptFontSize;
  showLogo: boolean;
  showTaxId: boolean;
  showCashier: boolean;
  showBarcode: boolean;
}

export interface ReceiptBusiness {
  name: string;
  address: string | null;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  header: string | null;
  footer: string | null;
  currencySymbol: string;
}

export interface ReceiptItem {
  productName: string;
  sku?: string | null;
  quantity: number;
  unitCode: string;
  unitPrice: number;
  lineTotal: number;
}

export interface ReceiptPayment {
  method: string;
  amount: number;
}

export interface ReceiptSale {
  saleNumber: string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  changeGiven: number;
  createdAt: string;
  cashierName: string;
}

export interface ReceiptData {
  business: ReceiptBusiness;
  sale: ReceiptSale;
  items: ReceiptItem[];
  payments: ReceiptPayment[];
}

export const FONT_PX: Record<ReceiptFontSize, number> = {
  small: 11,
  medium: 12,
  large: 13,
};
