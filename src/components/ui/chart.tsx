"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    color?: string;
  }
>;

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

export function ChartContainer({
  id,
  className,
  children,
  config,
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ReactNode;
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-legend-item-text]:text-foreground [&_.recharts-text]:fill-foreground [&_.recharts-dot[stroke='#fff']]:stroke-transparent flex aspect-video justify-center text-xs",
          className,
        )}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: Object.entries(config)
              .filter(([, value]) => value.color)
              .map(([key, value]) => `[data-chart=${chartId}] { --color-${key}: ${value.color}; }`)
              .join("\n"),
          }}
        />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

interface ChartTooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: string | number | null;
  color?: string;
}

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
}: ChartTooltipContentProps) {
  const { config } = useChart();

  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="min-w-[9rem] rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      {label ? <p className="mb-2 font-medium text-popover-foreground">{String(label)}</p> : null}
      <div className="space-y-1.5">
        {payload.map((item, index) => {
          const key = (item.dataKey as string) ?? (item.name as string) ?? `series-${index}`;
          const itemConfig = config[key];
          const itemLabel = itemConfig?.label ?? item.name ?? key;
          const itemColor = item.color ?? itemConfig?.color ?? "hsl(var(--primary))";

          return (
            <div key={key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: String(itemColor) }} />
              <span className="text-muted-foreground">{itemLabel}</span>
              <span className="ml-auto font-medium text-popover-foreground">
                {typeof item.value === "number" ? item.value.toLocaleString("en-US") : String(item.value ?? "-")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ChartLegend = RechartsPrimitive.Legend;

interface ChartLegendEntry {
  dataKey?: string | number;
  value?: string;
  color?: string;
}

interface ChartLegendContentProps {
  payload?: ChartLegendEntry[];
}

export function ChartLegendContent({ payload }: ChartLegendContentProps) {
  const { config } = useChart();

  if (!payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
      {payload.map((item, index) => {
        const key = (item.dataKey as string) ?? item.value ?? `legend-${index}`;
        const itemConfig = config[key];
        const itemLabel = itemConfig?.label ?? item.value;

        return (
          <div key={key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground">{itemLabel}</span>
          </div>
        );
      })}
    </div>
  );
}
