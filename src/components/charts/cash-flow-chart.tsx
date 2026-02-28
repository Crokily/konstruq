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
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {payload.map((entry) => {
        const key = String(entry.dataKey ?? "");

        return (
          <div key={key} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{labelByKey[key] ?? key}</span>
            <span className="ml-auto font-medium text-popover-foreground">
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
    <div className="h-[350px] min-h-[350px] w-full [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.8} />
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
            activeBar={false}
            stroke="none"
          />
          <Bar
            dataKey="apAmount"
            name="AP Amount"
            fill="#f43f5e"
            radius={[4, 4, 0, 0]}
            activeBar={false}
            stroke="none"
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
