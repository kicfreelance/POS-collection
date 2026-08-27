import type { ReceiptData } from "./types";

/** Sample data for the live preview in Settings. */
export const SAMPLE_RECEIPT: ReceiptData = {
  business: {
    name: "My Business",
    address: "123 Main Street, Colombo 05",
    taxId: "VAT 123456789-7000",
    phone: "+94 11 234 5678",
    email: "hello@mybusiness.lk",
    logoUrl: null,
    header: "Welcome!",
    footer: "Thank you — please come again",
    currencySymbol: "$",
  },
  sale: {
    saleNumber: "INV-000142",
    subtotal: 24.5,
    taxTotal: 2.45,
    discountTotal: 1.5,
    total: 25.45,
    changeGiven: 4.55,
    createdAt: new Date().toISOString(),
    cashierName: "Administrator",
  },
  items: [
    { productName: "Basmati Rice 1kg", sku: "RICE-1KG", quantity: 2, unitCode: "pcs", unitPrice: 6.0, lineTotal: 12.0 },
    { productName: "Fresh Milk 1L", sku: "MILK-1L", quantity: 1, unitCode: "pcs", unitPrice: 3.5, lineTotal: 3.5 },
    { productName: "Sugar 500g", sku: "SUG-500", quantity: 3, unitCode: "pcs", unitPrice: 2.0, lineTotal: 6.0 },
    { productName: "Tea Bags 50s", sku: "TEA-50", quantity: 1, unitCode: "box", unitPrice: 3.0, lineTotal: 3.0 },
  ],
  payments: [
    { method: "cash", amount: 20.0 },
    { method: "card", amount: 10.0 },
  ],
};
