"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartSpec } from "@/lib/dashboard/types";

const valueFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  notation: "compact",
});

function formatValue(value: unknown): string {
  if (typeof value === "number") {
    return valueFormatter.format(value);
  }

  if (typeof value === "string") {
    return value;
  }

  return String(value ?? "");
}

function humanizeLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function TooltipContent({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    color?: string;
    dataKey?: string;
    name?: string;
    value?: unknown;
  }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
      {label !== undefined ? (
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {String(label)}
        </p>
      ) : null}
      <div className="space-y-1.5">
        {payload.map((entry, index) => {
          const name = entry.name ?? entry.dataKey ?? `Series ${index + 1}`;

          return (
            <div key={`${name}-${index}`} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color ?? "currentColor" }}
              />
              <span className="text-muted-foreground">{humanizeLabel(name)}</span>
              <span className="ml-auto font-medium text-popover-foreground">
                {formatValue(entry.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function AxisChartFrame({ children }: { children: ReactNode }) {
  return (
    <div className="h-[280px] w-full [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border">
      {children}
    </div>
  );
}

export function DynamicChart({ chart }: { chart: ChartSpec }) {
  if (chart.data.length === 0) {
    return <ChartEmptyState message="No rows were available for this chart." />;
  }

  if (chart.type === "pie") {
    if (!chart.nameKey || !chart.valueKey) {
      return <ChartEmptyState message="This pie chart is missing required keys." />;
    }

    const nameKey = chart.nameKey;
    const valueKey = chart.valueKey;

    return (
      <div className="relative h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chart.data}
              dataKey={valueKey}
              nameKey={nameKey}
              innerRadius={64}
              outerRadius={98}
              paddingAngle={4}
              stroke="none"
            >
              {chart.data.map((entry, index) => {
                const entryKey =
                  typeof entry[nameKey] === "string"
                    ? entry[nameKey]
                    : `${chart.id}-${index}`;

                return (
                  <Cell
                    key={String(entryKey)}
                    fill={chart.colors[index % chart.colors.length]}
                  />
                );
              })}
            </Pie>
            <Tooltip content={<TooltipContent />} />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              formatter={(value) => (
                <span className="text-sm text-muted-foreground">{String(value)}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (!chart.xKey || !chart.yKeys || chart.yKeys.length === 0) {
    return <ChartEmptyState message="This chart is missing required axis keys." />;
  }

  if (chart.type === "scatter") {
    const yKey = chart.yKeys[0];

    return (
      <AxisChartFrame>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.8} />
            <XAxis
              type="number"
              dataKey={chart.xKey}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="number"
              dataKey={yKey}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<TooltipContent />} cursor={{ stroke: "var(--muted-foreground)" }} />
            <Scatter data={chart.data} fill={chart.colors[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      </AxisChartFrame>
    );
  }

  if (chart.type === "bar") {
    return (
      <AxisChartFrame>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.8} />
            <XAxis dataKey={chart.xKey} tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={formatValue} />
            <Tooltip content={<TooltipContent />} />
            <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 12 }} />
            {chart.yKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                name={humanizeLabel(key)}
                fill={chart.colors[index % chart.colors.length]}
                radius={[6, 6, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </AxisChartFrame>
    );
  }

  if (chart.type === "line") {
    return (
      <AxisChartFrame>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.8} />
            <XAxis dataKey={chart.xKey} tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={formatValue} />
            <Tooltip content={<TooltipContent />} />
            <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 12 }} />
            {chart.yKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={humanizeLabel(key)}
                stroke={chart.colors[index % chart.colors.length]}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </AxisChartFrame>
    );
  }

  return (
    <AxisChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chart.data}>
          <defs>
            {chart.yKeys.map((key, index) => {
              const gradientId = `${chart.id}-${key}-gradient`;
              const color = chart.colors[index % chart.colors.length];

              return (
                <linearGradient
                  key={gradientId}
                  id={gradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.03} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.8} />
          <XAxis dataKey={chart.xKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={formatValue} />
          <Tooltip content={<TooltipContent />} />
          <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 12 }} />
          {chart.yKeys.map((key, index) => {
            const gradientId = `${chart.id}-${key}-gradient`;
            const color = chart.colors[index % chart.colors.length];

            return (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={humanizeLabel(key)}
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                fillOpacity={1}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </AxisChartFrame>
  );
}
