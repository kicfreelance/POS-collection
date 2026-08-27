function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseDateRange(searchParams: { from?: string; to?: string; groupBy?: string }) {
  const from = searchParams.from ?? defaultFrom();
  const to = searchParams.to ?? defaultTo();
  const groupBy = (searchParams.groupBy ?? "daily") as "daily" | "weekly" | "monthly";
  return { from, to, groupBy };
}
