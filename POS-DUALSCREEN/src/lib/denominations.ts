// Generic denomination set for the opening/closing cash count grid and the
// checkout quick-cash buttons. Will move to Settings (currency/locale) later.
export const CASH_DENOMINATIONS = [5000, 1000, 500, 100, 50, 20, 10, 5, 1];

export function totalFromCounts(counts: Record<string, number>): number {
  return CASH_DENOMINATIONS.reduce((sum, denom) => sum + denom * (counts[denom] ?? 0), 0);
}
