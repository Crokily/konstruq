"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartRenderHints, ChartSpec, ChartSpecMetric } from "@/lib/charting/spec";
import { CHART_STYLE_SPEC } from "@/lib/charting/spec";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface ChartFromSpecProps {
  spec: ChartSpec;
  hints?: ChartRenderHints;
  warnings?: string[];
}

type SupportedChartType = ChartSpec["type"];

const SUPPORTED_CHART_TYPES: Set<SupportedChartType> = new Set([
  "bar",
  "line",
  "area",
  "pie",
  "scatter",
  "stacked-bar",
  "composed",
]);

const DEFAULT_HINTS: ChartRenderHints = {
  xAxisAngle: 0,
  xAxisHeight: 32,
  showLegend: true,
  height: 300,
};

function wrapLabel(value: unknown): string[] {
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  if (!text) {
    return [""];
  }

  const maxLineLength = 16;
  const normalized = text.replace(/[_/]+/g, " ").replace(/\s+/g, " ").trim();
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length <= maxLineLength) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [normalized];
}

function WrappedXAxisTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: unknown };
}) {
  const lines = wrapLabel(payload?.value);

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={10} textAnchor="middle" fill="currentColor" className="fill-muted-foreground text-[11px]">
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={0} dy={index === 0 ? 0 : 12}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function shouldUseHorizontalCategoryLayout(
  chartType: SupportedChartType,
  data: Array<Record<string, unknown>>,
  xAxisKey: string,
): boolean {
  if (chartType !== "bar" && chartType !== "stacked-bar") {
    return false;
  }

  const labels = data
    .map((row) => row[xAxisKey])
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .map((value) => String(value));

  if (labels.length === 0) {
    return false;
  }

  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0);
  const average = labels.reduce((sum, label) => sum + label.length, 0) / labels.length;

  return longest > 20 || (labels.length >= 6 && average > 12);
}

function parseMetricValue(value: unknown): number | unknown {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[$,%\s]/g, "").replace(/,/g, "");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return value;
}

function toFiniteNumber(value: unknown): number | null {
  const normalized = parseMetricValue(value);
  if (typeof normalized === "number" && Number.isFinite(normalized)) {
    return normalized;
  }
  return null;
}

function normalizeChartData(
  rows: Array<Record<string, unknown>>,
  metrics: ChartSpecMetric[],
): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const normalized = { ...row };
    for (const metric of metrics) {
      normalized[metric.key] = parseMetricValue(row[metric.key]);
    }
    return normalized;
  });
}

function getMetricColor(metric: ChartSpecMetric, index: number) {
  return metric.color ?? CHART_STYLE_SPEC.palette[index % CHART_STYLE_SPEC.palette.length];
}

function resolveChartType(type: string | undefined): SupportedChartType {
  if (type && SUPPORTED_CHART_TYPES.has(type as SupportedChartType)) {
    return type as SupportedChartType;
  }

  return "bar";
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function buildChartConfig(metrics: ChartSpecMetric[]): ChartConfig {
  return metrics.reduce<ChartConfig>((acc, metric, index) => {
    acc[metric.key] = {
      label: metric.label,
      color: getMetricColor(metric, index),
    };
    return acc;
  }, {});
}

interface PieDatum {
  name: string;
  value: number;
}

function buildPieData(
  rows: Array<Record<string, unknown>>,
  metrics: ChartSpecMetric[],
  xAxisKey: string,
): PieDatum[] {
  if (rows.length === 0 || metrics.length === 0) {
    return [];
  }

  const metricStats = metrics.map((metric) => {
    const values = rows.map((row) => toFiniteNumber(row[metric.key])).filter((value): value is number => value !== null);
    const nonZeroCount = values.filter((value) => value !== 0).length;
    return { metric, validCount: values.length, nonZeroCount };
  });

  const primaryMetric =
    metricStats
      .slice()
      .sort((left, right) => right.nonZeroCount - left.nonZeroCount || right.validCount - left.validCount)[0]?.metric ??
    metrics[0];

  const aggregatedByCategory = new Map<string, number>();
  rows.forEach((row, index) => {
    const amount = toFiniteNumber(row[primaryMetric.key]);
    if (amount === null) {
      return;
    }

    const rawName = row[xAxisKey];
    const name =
      typeof rawName === "string" || typeof rawName === "number"
        ? String(rawName).trim() || `Item ${index + 1}`
        : `Item ${index + 1}`;
    aggregatedByCategory.set(name, (aggregatedByCategory.get(name) ?? 0) + amount);
  });

  const categoryData = Array.from(aggregatedByCategory.entries())
    .map(([name, value]) => ({ name, value }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0);

  if (categoryData.length > 0) {
    return categoryData;
  }

  const metricData = metrics
    .map((metric) => {
      const sum = rows.reduce((total, row) => total + (toFiniteNumber(row[metric.key]) ?? 0), 0);
      return { name: metric.label, value: sum };
    })
    .filter((item) => Number.isFinite(item.value) && item.value > 0);

  return metricData;
}

export function ChartFromSpec({ spec, hints, warnings }: ChartFromSpecProps) {
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
  const renderHints = hints ?? DEFAULT_HINTS;
  const chartData = normalizeChartData(data, metrics);
  const pieData = buildPieData(chartData, metrics, xAxisKey);
  const horizontalCategoryLayout = shouldUseHorizontalCategoryLayout(chartType, chartData, xAxisKey);
  const longestLabelLength = chartData.reduce((max, row) => {
    const value = row[xAxisKey];
    const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
    return Math.max(max, text.length);
  }, 0);
  const yAxisCategoryWidth = Math.min(320, Math.max(140, longestLabelLength * 7));
  const chartHeight = horizontalCategoryLayout
    ? Math.max(renderHints.height, Math.min(700, data.length * 44 + 96))
    : renderHints.height;

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
  const chartConfig = buildChartConfig(metrics);

  if (metrics.length === 0) {
    return (
      <div className="w-full space-y-3">
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
        <EmptyChartState message="No metrics provided for this chart." />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full space-y-3">
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
        <EmptyChartState message="No data available for this chart." />
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className="space-y-1">
        <h4 className="text-base font-semibold tracking-tight text-foreground">{title}</h4>
        {spec.subtitle ? <p className="text-xs text-muted-foreground">{spec.subtitle}</p> : null}
      </div>
      {spec.selection?.rationale ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/90">Why this chart:</span> {spec.selection.rationale}
        </p>
      ) : null}
      {warnings && warnings.length > 0 ? (
        <div className="rounded-md border border-border/70 bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
          {warnings[0]}
        </div>
      ) : null}
      <ChartContainer config={chartConfig} className="w-full" style={{ height: `${chartHeight}px` }}>
        {chartType === "line" ? (
          <LineChart accessibilityLayer data={chartData} margin={CHART_STYLE_SPEC.chartMargin}>
            <CartesianGrid
              stroke={CHART_STYLE_SPEC.gridStroke}
              opacity={CHART_STYLE_SPEC.gridOpacity}
              strokeDasharray={CHART_STYLE_SPEC.gridDash}
            />
              <XAxis
                dataKey={xAxisKey}
                tickLine={false}
                axisLine={false}
                height={renderHints.xAxisHeight}
                tick={<WrappedXAxisTick />}
                interval={0}
              />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip cursor={{ fill: "rgba(148, 163, 184, 0.12)" }} content={<ChartTooltipContent />} />
            {renderHints.showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
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
          <AreaChart accessibilityLayer data={chartData} margin={CHART_STYLE_SPEC.chartMargin}>
            <CartesianGrid
              stroke={CHART_STYLE_SPEC.gridStroke}
              opacity={CHART_STYLE_SPEC.gridOpacity}
              strokeDasharray={CHART_STYLE_SPEC.gridDash}
            />
              <XAxis
                dataKey={xAxisKey}
                tickLine={false}
                axisLine={false}
                height={renderHints.xAxisHeight}
                tick={<WrappedXAxisTick />}
                interval={0}
              />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip cursor={{ fill: "rgba(148, 163, 184, 0.12)" }} content={<ChartTooltipContent />} />
            {renderHints.showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
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
          pieData.length === 0 ? (
            <EmptyChartState message="Pie chart needs at least one positive numeric series." />
          ) : (
            <PieChart accessibilityLayer margin={CHART_STYLE_SPEC.chartMargin}>
            <ChartTooltip content={<ChartTooltipContent />} />
            {renderHints.showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
            <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100}>
              {pieData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_STYLE_SPEC.palette[index % CHART_STYLE_SPEC.palette.length]} stroke="none" />
              ))}
            </Pie>
          </PieChart>
          )
        ) : chartType === "scatter" ? (
          <ScatterChart accessibilityLayer margin={CHART_STYLE_SPEC.chartMargin}>
            <CartesianGrid
              stroke={CHART_STYLE_SPEC.gridStroke}
              opacity={CHART_STYLE_SPEC.gridOpacity}
              strokeDasharray={CHART_STYLE_SPEC.gridDash}
            />
            <XAxis type="number" dataKey="x" tickLine={false} axisLine={false} />
            <YAxis type="number" dataKey="y" tickLine={false} axisLine={false} />
            <ChartTooltip
              cursor={{ stroke: "rgba(148, 163, 184, 0.45)", strokeDasharray: "3 3" }}
              content={<ChartTooltipContent />}
            />
            {renderHints.showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
            {hasScatterData ? (
              scatterSeries.map((series) => (
                <Scatter key={series.key} name={series.label} data={series.data} fill={series.color} />
              ))
            ) : (
              <Scatter name="No data" data={[]} fill={CHART_STYLE_SPEC.palette[0]} />
            )}
          </ScatterChart>
        ) : chartType === "stacked-bar" ? (
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={horizontalCategoryLayout ? { top: 8, right: 16, left: 16, bottom: 14 } : CHART_STYLE_SPEC.chartMargin}
            layout={horizontalCategoryLayout ? "vertical" : "horizontal"}
          >
            <CartesianGrid
              stroke={CHART_STYLE_SPEC.gridStroke}
              opacity={CHART_STYLE_SPEC.gridOpacity}
              strokeDasharray={CHART_STYLE_SPEC.gridDash}
            />
            {horizontalCategoryLayout ? (
              <>
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey={xAxisKey}
                  tickLine={false}
                  axisLine={false}
                  width={yAxisCategoryWidth}
                  interval={0}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey={xAxisKey}
                  tickLine={false}
                  axisLine={false}
                  height={renderHints.xAxisHeight}
                  tick={<WrappedXAxisTick />}
                  interval={0}
                />
                <YAxis tickLine={false} axisLine={false} />
              </>
            )}
            <ChartTooltip cursor={{ fill: "rgba(148, 163, 184, 0.12)" }} content={<ChartTooltipContent />} />
            {renderHints.showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
            {metrics.map((metric, index) => (
              <Bar
                key={metric.key}
                dataKey={metric.key}
                name={metric.label}
                fill={getMetricColor(metric, index)}
                stackId="stack"
                activeBar={false}
                stroke="none"
                radius={horizontalCategoryLayout ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        ) : chartType === "composed" ? (
          <ComposedChart accessibilityLayer data={chartData} margin={CHART_STYLE_SPEC.chartMargin}>
            <CartesianGrid
              stroke={CHART_STYLE_SPEC.gridStroke}
              opacity={CHART_STYLE_SPEC.gridOpacity}
              strokeDasharray={CHART_STYLE_SPEC.gridDash}
            />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              height={renderHints.xAxisHeight}
              tick={<WrappedXAxisTick />}
              interval={0}
            />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip cursor={{ fill: "rgba(148, 163, 184, 0.12)" }} content={<ChartTooltipContent />} />
            {renderHints.showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
            {metrics.map((metric, index) =>
              index === 0 ? (
                <Bar
                  key={metric.key}
                  dataKey={metric.key}
                  name={metric.label}
                  fill={getMetricColor(metric, index)}
                  activeBar={false}
                  stroke="none"
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
              ),
            )}
          </ComposedChart>
        ) : (
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={horizontalCategoryLayout ? { top: 8, right: 16, left: 16, bottom: 14 } : CHART_STYLE_SPEC.chartMargin}
            layout={horizontalCategoryLayout ? "vertical" : "horizontal"}
          >
            <CartesianGrid
              stroke={CHART_STYLE_SPEC.gridStroke}
              opacity={CHART_STYLE_SPEC.gridOpacity}
              strokeDasharray={CHART_STYLE_SPEC.gridDash}
            />
            {horizontalCategoryLayout ? (
              <>
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey={xAxisKey}
                  tickLine={false}
                  axisLine={false}
                  width={yAxisCategoryWidth}
                  interval={0}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey={xAxisKey}
                  tickLine={false}
                  axisLine={false}
                  height={renderHints.xAxisHeight}
                  tick={<WrappedXAxisTick />}
                  interval={0}
                />
                <YAxis tickLine={false} axisLine={false} />
              </>
            )}
            <ChartTooltip cursor={{ fill: "rgba(148, 163, 184, 0.12)" }} content={<ChartTooltipContent />} />
            {renderHints.showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
            {metrics.map((metric, index) => (
              <Bar
                key={metric.key}
                dataKey={metric.key}
                name={metric.label}
                fill={getMetricColor(metric, index)}
                activeBar={false}
                stroke="none"
                radius={horizontalCategoryLayout ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        )}
      </ChartContainer>
    </div>
  );
}
