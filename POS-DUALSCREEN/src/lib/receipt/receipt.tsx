"use client";

import { useEffect, useRef, type ReactNode } from "react";
import JsBarcode from "jsbarcode";
import { money, receiptDateTime } from "./format";
import { FONT_PX, type ReceiptData, type ReceiptStyle } from "./types";

const PAPER_PX: Record<ReceiptStyle["paperWidth"], string> = {
  "58mm": "58mm",
  "80mm": "80mm",
};

/* ------------------------------------------------------------------ atoms */

function Rule({ variant = "dashed" }: { variant?: "dashed" | "solid" | "double" }) {
  const borderStyle = variant === "double" ? "double" : variant === "solid" ? "solid" : "dashed";
  return (
    <div
      style={{
        borderTop: `${variant === "double" ? 3 : 1}px ${borderStyle} #000`,
        margin: "4px 0",
      }}
    />
  );
}

function Row({
  left,
  right,
  bold,
  muted,
  gap = 6,
}: {
  left: ReactNode;
  right?: ReactNode;
  bold?: boolean;
  muted?: boolean;
  gap?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap,
        fontWeight: bold ? 700 : 400,
        color: muted ? "#444" : "#000",
      }}
    >
      <span style={{ minWidth: 0, wordBreak: "break-word" }}>{left}</span>
      {right !== undefined && <span style={{ whiteSpace: "nowrap" }}>{right}</span>}
    </div>
  );
}

function Barcode({ value, height = 34 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        width: 1.4,
        height,
        fontSize: 10,
        margin: 0,
        displayValue: true,
      });
    } catch {
      /* invalid value — skip */
    }
  }, [value, height]);
  return <svg ref={ref} style={{ maxWidth: "100%" }} />;
}

function Logo({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- receipts print a data-URL / small raster; next/image is inappropriate here
    <img
      src={url}
      alt=""
      style={{ maxWidth: "60%", maxHeight: 90, margin: "0 auto 4px", display: "block" }}
    />
  );
}

/* --------------------------------------------------------------- templates */

function Header({
  data,
  style,
  align = "center",
  nameSize = 1.15,
}: {
  data: ReceiptData;
  style: ReceiptStyle;
  align?: "center" | "left";
  nameSize?: number;
}) {
  const b = data.business;
  return (
    <div style={{ textAlign: align }}>
      {style.showLogo && <Logo url={b.logoUrl} />}
      <div style={{ fontSize: `${nameSize}em`, fontWeight: 700 }}>{b.name}</div>
      {b.address && <div>{b.address}</div>}
      {style.showTaxId && b.taxId && <div>{b.taxId}</div>}
      {b.header && <div style={{ marginTop: 2 }}>{b.header}</div>}
    </div>
  );
}

function Meta({ data, style }: { data: ReceiptData; style: ReceiptStyle }) {
  return (
    <>
      <Row left={data.sale.saleNumber} right={receiptDateTime(data.sale.createdAt)} muted />
      {style.showCashier && <Row left={`Cashier: ${data.sale.cashierName}`} muted />}
    </>
  );
}

function Totals({
  data,
  bold = "total",
}: {
  data: ReceiptData;
  bold?: "total" | "none";
}) {
  const c = data.business.currencySymbol;
  const s = data.sale;
  return (
    <>
      <Row left="Subtotal" right={money(s.subtotal, c)} />
      {s.discountTotal > 0 && <Row left="Discount" right={`-${money(s.discountTotal, c)}`} />}
      <Row left="Tax" right={money(s.taxTotal, c)} />
      <Row left="TOTAL" right={money(s.total, c)} bold={bold === "total"} />
    </>
  );
}

function Payments({ data }: { data: ReceiptData }) {
  const c = data.business.currencySymbol;
  return (
    <>
      {data.payments.map((p, i) => (
        <Row key={i} left={<span style={{ textTransform: "capitalize" }}>{p.method}</span>} right={money(p.amount, c)} />
      ))}
      {data.sale.changeGiven > 0 && <Row left="Change" right={money(data.sale.changeGiven, c)} />}
    </>
  );
}

function Footer({ data }: { data: ReceiptData }) {
  return (
    <div style={{ textAlign: "center", marginTop: 6 }}>{data.business.footer || "Thank you!"}</div>
  );
}

function ClassicReceipt({ data, style }: { data: ReceiptData; style: ReceiptStyle }) {
  const c = data.business.currencySymbol;
  return (
    <>
      <Header data={data} style={style} />
      <Rule />
      <Meta data={data} style={style} />
      <Rule />
      {data.items.map((it, i) => (
        <div key={i} style={{ marginBottom: 2 }}>
          <Row left={it.productName} right={money(it.lineTotal, c)} />
          <Row left={`${it.quantity} ${it.unitCode} x ${money(it.unitPrice, c)}`} muted />
        </div>
      ))}
      <Rule />
      <Totals data={data} />
      <Rule />
      <Payments data={data} />
      <Rule />
      <Footer data={data} />
    </>
  );
}

function CompactReceipt({ data, style }: { data: ReceiptData; style: ReceiptStyle }) {
  const c = data.business.currencySymbol;
  return (
    <>
      <Header data={data} style={style} nameSize={1.05} />
      <Rule variant="solid" />
      <Meta data={data} style={style} />
      <Rule variant="solid" />
      {data.items.map((it, i) => (
        <Row key={i} left={`${it.quantity}x ${it.productName}`} right={money(it.lineTotal, c)} />
      ))}
      <Rule variant="solid" />
      <Totals data={data} />
      <Rule variant="solid" />
      <Payments data={data} />
      <Footer data={data} />
    </>
  );
}

function ModernReceipt({ data, style }: { data: ReceiptData; style: ReceiptStyle }) {
  const c = data.business.currencySymbol;
  const s = data.sale;
  return (
    <>
      <Header data={data} style={style} nameSize={1.45} />
      <div style={{ height: 6 }} />
      <Rule variant="solid" />
      <Meta data={data} style={style} />
      <Rule variant="solid" />
      <div style={{ margin: "4px 0" }}>
        {data.items.map((it, i) => (
          <div key={i} style={{ marginBottom: 3 }}>
            <Row left={it.productName} right={money(it.lineTotal, c)} bold />
            <Row left={`${it.quantity} ${it.unitCode} @ ${money(it.unitPrice, c)}`} muted />
          </div>
        ))}
      </div>
      <Rule variant="solid" />
      <Row left="Subtotal" right={money(s.subtotal, c)} />
      {s.discountTotal > 0 && <Row left="Discount" right={`-${money(s.discountTotal, c)}`} />}
      <Row left="Tax" right={money(s.taxTotal, c)} />
      <div
        style={{
          background: "#000",
          color: "#fff",
          display: "flex",
          justifyContent: "space-between",
          padding: "3px 6px",
          margin: "5px 0",
          fontWeight: 700,
          fontSize: "1.1em",
        }}
      >
        <span>TOTAL</span>
        <span>{money(s.total, c)}</span>
      </div>
      <Payments data={data} />
      <Rule variant="solid" />
      <Footer data={data} />
    </>
  );
}

function DetailedReceipt({ data, style }: { data: ReceiptData; style: ReceiptStyle }) {
  const c = data.business.currencySymbol;
  const s = data.sale;
  const b = data.business;
  const taxable = s.subtotal - s.discountTotal;
  const effRate = taxable > 0 ? (s.taxTotal / taxable) * 100 : 0;
  return (
    <>
      <Header data={data} style={style} align="left" />
      {(b.phone || b.email) && (
        <div style={{ fontSize: "0.92em", color: "#333" }}>
          {b.phone && <div>Tel: {b.phone}</div>}
          {b.email && <div>{b.email}</div>}
        </div>
      )}
      <Rule />
      <Meta data={data} style={style} />
      <Rule />
      <div style={{ display: "flex", fontWeight: 700, gap: 4 }}>
        <span style={{ flex: 1 }}>Item</span>
        <span style={{ width: "3ch", textAlign: "right" }}>Qty</span>
        <span style={{ width: "7ch", textAlign: "right" }}>Price</span>
        <span style={{ width: "8ch", textAlign: "right" }}>Total</span>
      </div>
      {data.items.map((it, i) => (
        <div key={i} style={{ marginBottom: 2 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <span style={{ flex: 1, wordBreak: "break-word" }}>{it.productName}</span>
            <span style={{ width: "3ch", textAlign: "right" }}>{it.quantity}</span>
            <span style={{ width: "7ch", textAlign: "right" }}>{it.unitPrice.toFixed(2)}</span>
            <span style={{ width: "8ch", textAlign: "right" }}>{it.lineTotal.toFixed(2)}</span>
          </div>
          {it.sku && (
            <div style={{ color: "#555", fontSize: "0.9em" }}>
              SKU {it.sku} · {it.unitCode}
            </div>
          )}
        </div>
      ))}
      <Rule />
      <Row left="Subtotal" right={money(s.subtotal, c)} />
      {s.discountTotal > 0 && <Row left="Discount" right={`-${money(s.discountTotal, c)}`} />}
      <Row left="Taxable" right={money(taxable, c)} />
      <Row left={`Tax (${effRate.toFixed(1)}%)`} right={money(s.taxTotal, c)} />
      <Row left="TOTAL" right={money(s.total, c)} bold />
      <Rule />
      <Payments data={data} />
      <Rule />
      {style.showBarcode && (
        <div style={{ textAlign: "center", margin: "6px 0" }}>
          <Barcode value={s.saleNumber} />
        </div>
      )}
      <Footer data={data} />
    </>
  );
}

function MinimalReceipt({ data, style }: { data: ReceiptData; style: ReceiptStyle }) {
  const c = data.business.currencySymbol;
  return (
    <>
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: "1.1em" }}>{data.business.name}</div>
      <div style={{ textAlign: "center", color: "#444", marginBottom: 4 }}>
        {receiptDateTime(data.sale.createdAt)}
      </div>
      {data.items.map((it, i) => (
        <Row key={i} left={`${it.quantity > 1 ? `${it.quantity}x ` : ""}${it.productName}`} right={money(it.lineTotal, c)} />
      ))}
      <Rule variant="solid" />
      <Row left="TOTAL" right={money(data.sale.total, c)} bold />
      {style.showBarcode && (
        <div style={{ textAlign: "center", margin: "6px 0" }}>
          <Barcode value={data.sale.saleNumber} height={28} />
        </div>
      )}
      <Footer data={data} />
    </>
  );
}

const TEMPLATES = {
  classic: ClassicReceipt,
  compact: CompactReceipt,
  modern: ModernReceipt,
  detailed: DetailedReceipt,
  minimal: MinimalReceipt,
} as const;

/* ----------------------------------------------------------------- <Receipt> */

export function Receipt({
  data,
  style,
  print = false,
}: {
  data: ReceiptData;
  style: ReceiptStyle;
  print?: boolean;
}) {
  const Body = TEMPLATES[style.template] ?? ClassicReceipt;
  const pad = style.paperWidth === "58mm" ? "1.5mm 1mm" : "2mm 1.5mm";

  return (
    <div
      className="receipt-root"
      style={{
        width: PAPER_PX[style.paperWidth],
        boxSizing: "border-box",
        padding: pad,
        background: "#fff",
        color: "#000",
        fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: FONT_PX[style.fontSize],
        lineHeight: 1.35,
      }}
    >
      {print && (
        <style>{`@page{size:${style.paperWidth} auto;margin:0}
html,body{margin:0!important;padding:0!important;background:#fff}
@media print{header,.receipt-actions{display:none!important}
.receipt-root{width:${style.paperWidth}!important}}`}</style>
      )}
      <Body data={data} style={style} />
    </div>
  );
}
