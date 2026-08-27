import { notFound, redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/rbac";
import { getBusinessSettings } from "@/lib/settings-server";
import type { ReceiptData, ReceiptStyle } from "@/lib/receipt/types";
import { ReceiptView } from "./receipt-view";

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const isPrint = (await searchParams).print === "1";
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { rows: saleRows } = await pool.query<{
    id: string;
    sale_number: string;
    subtotal: string;
    tax_total: string;
    discount_total: string;
    total: string;
    change_given: string;
    created_at: string;
    cashier_name: string;
  }>(
    `SELECT s.id, s.sale_number, s.subtotal, s.tax_total, s.discount_total, s.total, s.change_given, s.created_at,
            u.full_name AS cashier_name
     FROM sales s
     JOIN users u ON u.id = s.cashier_id
     WHERE s.id = $1`,
    [id],
  );
  const sale = saleRows[0];
  if (!sale) {
    notFound();
  }

  const { rows: items } = await pool.query<{
    product_name: string;
    sku: string | null;
    quantity: string;
    unit_code: string;
    unit_price: string;
    line_total: string;
  }>(
    `SELECT si.product_name, p.sku, si.quantity, si.unit_code, si.unit_price, si.line_total
     FROM sale_items si
     LEFT JOIN products p ON p.id = si.product_id
     WHERE si.sale_id = $1 ORDER BY si.created_at`,
    [id],
  );

  const { rows: payments } = await pool.query<{ method: string; amount: string }>(
    `SELECT method, amount FROM sale_payments WHERE sale_id = $1 ORDER BY created_at`,
    [id],
  );

  const s = await getBusinessSettings();

  const data: ReceiptData = {
    business: {
      name: s.businessName,
      address: s.address,
      taxId: s.taxId,
      phone: s.contactPhone,
      email: s.contactEmail,
      logoUrl: s.logoUrl,
      header: s.receiptHeader,
      footer: s.receiptFooter,
      currencySymbol: s.currencySymbol,
    },
    sale: {
      saleNumber: sale.sale_number,
      subtotal: Number(sale.subtotal),
      taxTotal: Number(sale.tax_total),
      discountTotal: Number(sale.discount_total),
      total: Number(sale.total),
      changeGiven: Number(sale.change_given),
      createdAt: sale.created_at,
      cashierName: sale.cashier_name,
    },
    items: items.map((item) => ({
      productName: item.product_name,
      sku: item.sku,
      quantity: Number(item.quantity),
      unitCode: item.unit_code,
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.line_total),
    })),
    payments: payments.map((payment) => ({
      method: payment.method,
      amount: Number(payment.amount),
    })),
  };

  const style: ReceiptStyle = {
    template: s.receiptTemplate,
    paperWidth: s.receiptPaperWidth,
    fontSize: s.receiptFontSize,
    showLogo: s.receiptShowLogo,
    showTaxId: s.receiptShowTaxId,
    showCashier: s.receiptShowCashier,
    showBarcode: s.receiptShowBarcode,
  };

  return <ReceiptView saleId={id} data={data} style={style} print={isPrint} />;
}
