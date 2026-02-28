"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
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

export interface ChartSpecMetric {
  key: string;
  label: string;
  color?: string;
}

export interface ChartSpec {
  type: "bar" | "line" | "area" | "pie" | "scatter" | "stacked-bar" | "composed";
  title: string;
  xAxisKey: string;
  metrics: ChartSpecMetric[];
  data: Array<Record<string, unknown>>;
}

interface ChartFromSpecProps {
  spec: ChartSpec;
}

interface TooltipPayloadEntry {
  name?: string | number;
  value?: string | number | null;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayloadEntry[];
}

type SupportedChartType = ChartSpec["type"];

const DEFAULT_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#e11d48", "#8b5cf6", "#06b6d4"] as const;
const CHART_MARGIN = { top: 8, right: 12, left: 8, bottom: 12 } as const;
const SUPPORTED_CHART_TYPES: Set<SupportedChartType> = new Set([
  "bar",
  "line",
  "area",
  "pie",
  "scatter",
  "stacked-bar",
  "composed",
]);

function getMetricColor(metric: ChartSpecMetric, index: number) {
  return metric.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

function resolveChartType(type: string | undefined): SupportedChartType {
  if (type && SUPPORTED_CHART_TYPES.has(type as SupportedChartType)) {
    return type as SupportedChartType;
  }

  return "bar";
}

function formatTooltipValue(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString("en-US") : String(value);
  }

  if (typeof value === "string") {
    return value;
  }

  return "-";
}

function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur">
      {label !== undefined && label !== null ? (
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
      ) : null}
      {payload.map((entry, index) => {
        const labelText =
          typeof entry.name === "string" || typeof entry.name === "number"
            ? String(entry.name)
            : `Series ${index + 1}`;
        const color = entry.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];

        return (
          <div key={`${labelText}-${index}`} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-slate-300">{labelText}</span>
            <span className="ml-auto font-medium text-slate-100">{formatTooltipValue(entry.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-4 text-sm text-slate-400">
      {message}
    </div>
  );
}

export function ChartFromSpec({ spec }: ChartFromSpecProps) {
  const metrics = Array.isArray(spec.metrics)
    ? spec.metrics.filter((metric): metric is ChartSpecMetric => {
        return (
          typeof metric === "object" &&
          metric !== null &&
          typeof metric.key === "string" &&
          metric.key.trim().length > 0 &&
          typeof metric.label === "string" &&
          metric.label.trim().length > 0
        );
      })
    : [];
  const data = Array.isArray(spec.data)
    ? spec.data.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    : [];

  const title = typeof spec.title === "string" && spec.title.trim().length > 0 ? spec.title : "Chart";
  const xAxisKey =
    typeof spec.xAxisKey === "string" && spec.xAxisKey.trim().length > 0 ? spec.xAxisKey : "name";
  const chartType = resolveChartType(spec.type);

  const scatterSeries = metrics.map((metric, index) => ({
    key: metric.key,
    label: metric.label,
    color: getMetricColor(metric, index),
    data: data
      .map((row) => {
        const rawX = row[xAxisKey];
        const rawY = row[metric.key];
        const x = typeof rawX === "number" ? rawX : Number(rawX);
        const y = typeof rawY === "number" ? rawY : Number(rawY);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return null;
        }

        return { x, y };
      })
      .filter((point): point is { x: number; y: number } => point !== null),
  }));

  const hasScatterData = scatterSeries.some((series) => series.data.length > 0);

  if (metrics.length === 0) {
    return (
      <div className="w-full space-y-3">
        <h4 className="text-sm font-medium text-slate-200">{title}</h4>
        <EmptyChartState message="No metrics provided for this chart." />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full space-y-3">
        <h4 className="text-sm font-medium text-slate-200">{title}</h4>
        <EmptyChartState message="No data available for this chart." />
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <h4 className="text-sm font-medium text-slate-200">{title}</h4>
      <div className="w-full [&_.recharts-cartesian-axis-tick-value]:fill-slate-400">
        <ResponsiveContainer width="100%" height={300}>
          {chartType === "line" ? (
            <LineChart data={data} margin={CHART_MARGIN}>
              <CartesianGrid stroke="#334155" opacity={0.35} strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(148, 163, 184, 0.12)" }} content={<ChartTooltip />} />
              <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 12 }} />
              {metrics.map((metric, index) => (
                <Line
                  key={metric.key}
                  type="monotone"
                  dataKey={metric.key}
                  name={metric.label}
                  stroke={getMetricColor(metric, index)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          ) : chartType === "area" ? (
            <AreaChart data={data} margin={CHART_MARGIN}>
              <CartesianGrid stroke="#334155" opacity={0.35} strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(148, 163, 184, 0.12)" }} content={<ChartTooltip />} />
              <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 12 }} />
              {metrics.map((metric, index) => (
                <Area
                  key={metric.key}
                  type="monotone"
                  dataKey={metric.key}
                  name={metric.label}
                  stroke={getMetricColor(metric, index)}
                  fill={getMetricColor(metric, index)}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          ) : chartType === "pie" ? (
            <PieChart margin={CHART_MARGIN}>
              <Tooltip content={<ChartTooltip />} />
              <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 12 }} />
              <Pie
                data={data}
                dataKey={metrics[0].key}
                nameKey={xAxisKey}
                name={metrics[0].label}
                outerRadius={100}
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                    stroke="none"
                  />
                ))}
              </Pie>
            </PieChart>
          ) : chartType === "scatter" ? (
            <ScatterChart margin={CHART_MARGIN}>
              <CartesianGrid stroke="#334155" opacity={0.35} strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" tickLine={false} axisLine={false} />
              <YAxis type="number" dataKey="y" tickLine={false} axisLine={false} />
              <Tooltip cursor={{ stroke: "rgba(148, 163, 184, 0.45)", strokeDasharray: "3 3" }} content={<ChartTooltip />} />
              <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 12 }} />
              {hasScatterData ? (
                scatterSeries.map((series) => (
                  <Scatter key={series.key} name={series.label} data={series.data} fill={series.color} />
                ))
              ) : (
                <Scatter name="No data" data={[]} fill={DEFAULT_COLORS[0]} />
              )}
            </ScatterChart>
          ) : chartType === "stacked-bar" ? (
            <BarChart data={data} margin={CHART_MARGIN}>
              <CartesianGrid stroke="#334155" opacity={0.35} strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(148, 163, 184, 0.12)" }} content={<ChartTooltip />} />
              <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 12 }} />
              {metrics.map((metric, index) => (
                <Bar
                  key={metric.key}
                  dataKey={metric.key}
                  name={metric.label}
                  fill={getMetricColor(metric, index)}
                  stackId="stack"
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          ) : chartType === "composed" ? (
            <ComposedChart data={data} margin={CHART_MARGIN}>
              <CartesianGrid stroke="#334155" opacity={0.35} strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(148, 163, 184, 0.12)" }} content={<ChartTooltip />} />
              <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 12 }} />
              {metrics.map((metric, index) =>
                index === 0 ? (
                  <Bar
                    key={metric.key}
                    dataKey={metric.key}
                    name={metric.label}
                    fill={getMetricColor(metric, index)}
                    radius={[4, 4, 0, 0]}
                  />
                ) : (
                  <Line
                    key={metric.key}
                    type="monotone"
                    dataKey={metric.key}
                    name={metric.label}
                    stroke={getMetricColor(metric, index)}
                    strokeWidth={2}
                    dot={false}
                  />
                )
              )}
            </ComposedChart>
          ) : (
            <BarChart data={data} margin={CHART_MARGIN}>
              <CartesianGrid stroke="#334155" opacity={0.35} strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(148, 163, 184, 0.12)" }} content={<ChartTooltip />} />
              <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 12 }} />
              {metrics.map((metric, index) => (
                <Bar
                  key={metric.key}
                  dataKey={metric.key}
                  name={metric.label}
                  fill={getMetricColor(metric, index)}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
