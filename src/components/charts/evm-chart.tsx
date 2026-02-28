"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EVMDataPoint } from "@/lib/data";

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
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

interface EVMChartProps {
  data: EVMDataPoint[];
}

function formatMonthLabel(month: string): string {
  const [yearString, monthString] = month.split("-");
  const monthIndex = Number(monthString) - 1;

  if (!yearString || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return month;
  }

  return `${monthNames[monthIndex]} ${yearString.slice(-2)}`;
}

function EVMTooltip({
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
    plannedValue: "PV",
    earnedValue: "EV",
    actualCost: "AC",
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

export function EVMChart({ data }: EVMChartProps) {
  const chartData = data.map((point) => ({
    ...point,
    monthLabel: formatMonthLabel(point.month),
  }));

  return (
    <div className="h-[350px] min-h-[350px] w-full [&_.recharts-cartesian-axis-tick-value]:fill-slate-400 [&_.recharts-cartesian-grid_line]:stroke-slate-800">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
          <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => axisCurrencyFormatter.format(value)}
          />
          <Tooltip content={<EVMTooltip />} />
          <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 12 }} />
          <Line
            type="monotone"
            dataKey="plannedValue"
            name="PV"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={{ r: 3, strokeWidth: 1, fill: "#3b82f6" }}
          />
          <Line
            type="monotone"
            dataKey="earnedValue"
            name="EV"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 1, fill: "#10b981" }}
          />
          <Line
            type="monotone"
            dataKey="actualCost"
            name="AC"
            stroke="#e11d48"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 1, fill: "#e11d48" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
