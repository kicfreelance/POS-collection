/** Money formatter for receipts. The app has no shared formatter; keep this local. */
export function money(n: number, symbol: string): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${symbol}${Math.abs(n).toFixed(2)}`;
}

export function receiptDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
