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
import type { AgingReport } from "@/lib/data";

const bucketOrder = ["Current", "1-30", "31-60", "61-90", "90+"] as const;

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

function AgingTooltip({
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
    ar: "AR",
    ap: "AP",
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

interface AgingChartProps {
  data: AgingReport;
}

export function AgingChart({ data }: AgingChartProps) {
  const arByLabel = new Map(data.ar.map((bucket) => [bucket.label, bucket.amount]));
  const apByLabel = new Map(data.ap.map((bucket) => [bucket.label, bucket.amount]));

  const chartData = bucketOrder.map((bucket) => ({
    bucket,
    ar: arByLabel.get(bucket) ?? 0,
    ap: apByLabel.get(bucket) ?? 0,
  }));

  return (
    <div className="h-[350px] min-h-[350px] w-full [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.8} />
          <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => axisCurrencyFormatter.format(value)}
          />
          <Tooltip cursor={{ fill: "color-mix(in oklab, var(--muted) 80%, transparent)" }} content={<AgingTooltip />} />
          <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 12 }} />
          <Bar dataKey="ar" name="AR" fill="#10b981" radius={[4, 4, 0, 0]} activeBar={false} stroke="none" />
          <Bar dataKey="ap" name="AP" fill="#f43f5e" radius={[4, 4, 0, 0]} activeBar={false} stroke="none" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
