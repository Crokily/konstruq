"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RevenueExpenseTrendPoint } from "@/lib/data";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });

function toMonthLabel(month: string): string {
  const [yearString, monthString] = month.split("-");
  const year = Number(yearString);
  const monthIndex = Number(monthString) - 1;

  if (Number.isNaN(year) || Number.isNaN(monthIndex)) {
    return month;
  }

  return monthFormatter.format(new Date(year, monthIndex, 1));
}

function RevenueExpenseTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ dataKey?: string; value?: number }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {payload.map((entry) => {
        const isRevenue = entry.dataKey === "revenue";

        return (
          <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
            <span
              className={`h-2.5 w-2.5 rounded-full ${isRevenue ? "bg-emerald-500" : "bg-rose-500"}`}
            />
            <span className="text-muted-foreground">
              {isRevenue ? "Revenue" : "Expenses"}
            </span>
            <span className="ml-auto font-medium text-popover-foreground">
              {currencyFormatter.format(entry.value ?? 0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface RevenueExpenseChartProps {
  data: RevenueExpenseTrendPoint[];
}

export function RevenueExpenseChart({ data }: RevenueExpenseChartProps) {
  const chartData = data.slice(-12).map((point) => ({
    ...point,
    monthLabel: toMonthLabel(point.month),
  }));

  return (
    <div className="h-[300px] min-h-[300px] w-full [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" opacity={0.8} />
          <XAxis
            dataKey="monthLabel"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => currencyFormatter.format(value)}
          />
          <Tooltip content={<RevenueExpenseTooltip />} />

          <Area
            type="monotone"
            dataKey="expenses"
            name="Expenses"
            stroke="#f43f5e"
            strokeWidth={2}
            fill="url(#expensesGradient)"
            fillOpacity={1}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#revenueGradient)"
            fillOpacity={1}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
