"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CostBreakdown } from "@/lib/data";

const categoryConfig = [
  { key: "labor", label: "Labor" },
  { key: "materials", label: "Materials" },
  { key: "subcontract", label: "Subcontract" },
  { key: "equipment", label: "Equipment" },
  { key: "overhead", label: "Overhead" },
] as const;

const axisCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const tooltipCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface CostBreakdownChartProps {
  data: CostBreakdown;
}

function CostBreakdownTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ dataKey?: string; value?: number; color?: string }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </p>
      {payload.map((entry) => {
        const key = String(entry.dataKey ?? "");
        const metricLabel = key.charAt(0).toUpperCase() + key.slice(1);

        return (
          <div key={key} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-300">{metricLabel}</span>
            <span className="ml-auto font-medium text-slate-100">
              {tooltipCurrencyFormatter.format(entry.value ?? 0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CostBreakdownChart({ data }: CostBreakdownChartProps) {
  const chartData = categoryConfig.map((category) => ({
    category: category.label,
    budget: data[category.key].budget,
    actual: data[category.key].actual,
    committed: data[category.key].committed,
  }));

  return (
    <div className="h-[350px] min-h-[350px] w-full [&_.recharts-cartesian-axis-tick-value]:fill-slate-400 [&_.recharts-cartesian-grid_line]:stroke-slate-800">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
          <XAxis dataKey="category" tickLine={false} axisLine={false} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => axisCurrencyFormatter.format(value)}
          />
          <Tooltip cursor={{ fill: "rgba(148, 163, 184, 0.12)" }} content={<CostBreakdownTooltip />} />
          <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 12 }} />
          <Bar dataKey="budget" name="Budget" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="actual" name="Actual" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          <Bar dataKey="committed" name="Committed" fill="#64748b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
