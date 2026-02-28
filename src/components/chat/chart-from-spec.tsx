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
        <div className="rounded-md border border-amber-300/40 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-300">
          {warnings[0]}
        </div>
      ) : null}
      <ChartContainer config={chartConfig} className="w-full" style={{ height: `${renderHints.height}px` }}>
        {chartType === "line" ? (
          <LineChart accessibilityLayer data={data} margin={CHART_STYLE_SPEC.chartMargin}>
            <CartesianGrid
              stroke={CHART_STYLE_SPEC.gridStroke}
              opacity={CHART_STYLE_SPEC.gridOpacity}
              strokeDasharray={CHART_STYLE_SPEC.gridDash}
            />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              angle={renderHints.xAxisAngle}
              textAnchor={renderHints.xAxisAngle === 0 ? "middle" : "end"}
              height={renderHints.xAxisHeight}
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
          <AreaChart accessibilityLayer data={data} margin={CHART_STYLE_SPEC.chartMargin}>
            <CartesianGrid
              stroke={CHART_STYLE_SPEC.gridStroke}
              opacity={CHART_STYLE_SPEC.gridOpacity}
              strokeDasharray={CHART_STYLE_SPEC.gridDash}
            />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              angle={renderHints.xAxisAngle}
              textAnchor={renderHints.xAxisAngle === 0 ? "middle" : "end"}
              height={renderHints.xAxisHeight}
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
          <PieChart accessibilityLayer margin={CHART_STYLE_SPEC.chartMargin}>
            <ChartTooltip content={<ChartTooltipContent />} />
            {renderHints.showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
            <Pie data={data} dataKey={metrics[0].key} nameKey={xAxisKey} name={metrics[0].label} outerRadius={100}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_STYLE_SPEC.palette[index % CHART_STYLE_SPEC.palette.length]} stroke="none" />
              ))}
            </Pie>
          </PieChart>
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
          <BarChart accessibilityLayer data={data} margin={CHART_STYLE_SPEC.chartMargin}>
            <CartesianGrid
              stroke={CHART_STYLE_SPEC.gridStroke}
              opacity={CHART_STYLE_SPEC.gridOpacity}
              strokeDasharray={CHART_STYLE_SPEC.gridDash}
            />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              angle={renderHints.xAxisAngle}
              textAnchor={renderHints.xAxisAngle === 0 ? "middle" : "end"}
              height={renderHints.xAxisHeight}
            />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip cursor={{ fill: "rgba(148, 163, 184, 0.12)" }} content={<ChartTooltipContent />} />
            {renderHints.showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
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
          <ComposedChart accessibilityLayer data={data} margin={CHART_STYLE_SPEC.chartMargin}>
            <CartesianGrid
              stroke={CHART_STYLE_SPEC.gridStroke}
              opacity={CHART_STYLE_SPEC.gridOpacity}
              strokeDasharray={CHART_STYLE_SPEC.gridDash}
            />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              angle={renderHints.xAxisAngle}
              textAnchor={renderHints.xAxisAngle === 0 ? "middle" : "end"}
              height={renderHints.xAxisHeight}
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
          <BarChart accessibilityLayer data={data} margin={CHART_STYLE_SPEC.chartMargin}>
            <CartesianGrid
              stroke={CHART_STYLE_SPEC.gridStroke}
              opacity={CHART_STYLE_SPEC.gridOpacity}
              strokeDasharray={CHART_STYLE_SPEC.gridDash}
            />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              angle={renderHints.xAxisAngle}
              textAnchor={renderHints.xAxisAngle === 0 ? "middle" : "end"}
              height={renderHints.xAxisHeight}
            />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip cursor={{ fill: "rgba(148, 163, 184, 0.12)" }} content={<ChartTooltipContent />} />
            {renderHints.showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
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
      </ChartContainer>
    </div>
  );
}
