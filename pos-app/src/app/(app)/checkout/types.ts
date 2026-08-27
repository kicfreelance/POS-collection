export interface ProductForSale {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  categoryId: string | null;
  baseUnit: string;
  baseUnitName: string;
  sellingPrice: number;
  taxRate: number;
  discountType: "percentage" | "flat" | null;
  discountValue: number | null;
  subUnit: { code: string; name: string; factor: number } | null;
  imageDataUrl: string | null;
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface CustomerOption {
  id: string;
  name: string;
  isCreditCustomer: boolean;
}

export interface CartLine {
  key: string;
  productId: string;
  categoryId: string | null;
  name: string;
  baseUnit: string;
  baseUnitName: string;
  unitCode: string;
  unitName: string;
  subUnit: { code: string; name: string; factor: number } | null;
  quantity: number;
  sellingPrice: number;
  taxRate: number;
  discountType: "percentage" | "flat" | null;
  discountValue: number | null;
}

export function unitPriceFor(line: CartLine): number {
  if (line.unitCode === line.baseUnit) return line.sellingPrice;
  if (line.subUnit && line.unitCode === line.subUnit.code) {
    return line.sellingPrice / line.subUnit.factor;
  }
  return line.sellingPrice;
}

export function lineSubtotal(line: CartLine): number {
  return unitPriceFor(line) * line.quantity;
}

export function lineProductDiscount(line: CartLine): number {
  if (!line.discountType || !line.discountValue) return 0;
  const subtotal = lineSubtotal(line);
  const raw =
    line.discountType === "percentage" ? subtotal * (line.discountValue / 100) : line.discountValue;
  return Math.min(raw, subtotal);
}

// When tax-inclusive, the selling price already contains tax, so it's backed
// out of the gross amount rather than added on top of a net amount.
export function lineTax(line: CartLine, taxInclusive: boolean): number {
  const amount = lineSubtotal(line) - lineProductDiscount(line);
  return taxInclusive
    ? amount * (line.taxRate / (100 + line.taxRate))
    : amount * (line.taxRate / 100);
}

export function lineTotal(line: CartLine, taxInclusive: boolean): number {
  const amount = lineSubtotal(line) - lineProductDiscount(line);
  return taxInclusive ? amount : amount + lineTax(line, taxInclusive);
}
