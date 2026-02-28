"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CashFlowForecastPoint } from "@/lib/data";

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

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
});

function formatMonthLabel(month: string): string {
  const [yearString, monthString] = month.split("-");
  const year = Number(yearString);
  const monthIndex = Number(monthString) - 1;

  if (Number.isNaN(year) || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return month;
  }

  return monthFormatter.format(new Date(year, monthIndex, 1));
}

function CashFlowTooltip({
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

  const labelByKey: Record<string, string> = {
    arAmount: "AR Amount",
    apAmount: "AP Amount",
    netCashFlow: "Net Cash Flow",
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </p>
      {payload.map((entry) => {
        const key = String(entry.dataKey ?? "");

        return (
          <div key={key} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-300">{labelByKey[key] ?? key}</span>
            <span className="ml-auto font-medium text-slate-100">
              {tooltipCurrencyFormatter.format(entry.value ?? 0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface CashFlowChartProps {
  data: CashFlowForecastPoint[];
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  const chartData = data.slice(-6).map((point) => ({
    ...point,
    monthLabel: formatMonthLabel(point.month),
  }));

  return (
    <div className="h-[350px] min-h-[350px] w-full [&_.recharts-cartesian-axis-tick-value]:fill-slate-400 [&_.recharts-cartesian-grid_line]:stroke-slate-800">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
          <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => axisCurrencyFormatter.format(value)}
          />
          <Tooltip content={<CashFlowTooltip />} />
          <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 12 }} />
          <Bar
            dataKey="arAmount"
            name="AR Amount"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="apAmount"
            name="AP Amount"
            fill="#f43f5e"
            radius={[4, 4, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="netCashFlow"
            name="Net Cash Flow"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 3, fill: "#f59e0b", strokeWidth: 1 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
