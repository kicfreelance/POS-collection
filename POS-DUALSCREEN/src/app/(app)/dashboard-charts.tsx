"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

const PIE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export interface TrendPoint {
  date: string;
  label: string;
  total: number;
}

export function SalesTrendChart({ data, currencySymbol }: { data: TrendPoint[]; currencySymbol: string }) {
  const config = {
    total: { label: "Sales", color: "var(--color-chart-1)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <AreaChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={56}
          tickFormatter={(value: number) => `${currencySymbol}${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_value, payload) => payload?.[0]?.payload?.date ?? ""}
              formatter={(value) => [`${currencySymbol}${Number(value).toFixed(2)}`, "Sales"]}
            />
          }
        />
        <Area dataKey="total" type="monotone" fill="url(#salesTrendFill)" stroke="var(--color-total)" strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  );
}

export interface CategorySlice {
  category: string;
  total: number;
}

export function CategoryPieChart({ data, currencySymbol }: { data: CategorySlice[]; currencySymbol: string }) {
  const config = Object.fromEntries(
    data.map((d) => [d.category, { label: d.category }]),
  ) satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <PieChart>
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => `${currencySymbol}${Number(value).toFixed(2)}`} />}
        />
        <Pie data={data} dataKey="total" nameKey="category" innerRadius={50} outerRadius={90} strokeWidth={2}>
          {data.map((entry, index) => (
            <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="category" />} />
      </PieChart>
    </ChartContainer>
  );
}

export interface ProductBar {
  name: string;
  total: number;
}

export function TopProductsChart({ data, currencySymbol }: { data: ProductBar[]; currencySymbol: string }) {
  const config = {
    total: { label: "Revenue", color: "var(--color-chart-2)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 12, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => `${currencySymbol}${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={110}
          tick={{ fontSize: 12 }}
          tickFormatter={(value: string) => (value.length > 16 ? `${value.slice(0, 15)}…` : value)}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => `${currencySymbol}${Number(value).toFixed(2)}`} />}
        />
        <Bar dataKey="total" fill="var(--color-total)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
