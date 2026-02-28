"use client";

import { Badge } from "@/components/ui/badge";
import type { EVMDataPoint } from "@/lib/data";
import { cn } from "@/lib/utils";

interface EVMKpiBadgesProps {
  data: EVMDataPoint[];
}

type Tone = "positive" | "negative" | "neutral";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const toneClassNames: Record<Tone, string> = {
  positive: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  negative: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  neutral: "border-border bg-muted/60 text-foreground",
};

function getMetricTone(value: number, threshold = 0): Tone {
  if (value > threshold) {
    return "positive";
  }

  if (value < threshold) {
    return "negative";
  }

  return "neutral";
}

export function EVMKpiBadges({ data }: EVMKpiBadgesProps) {
  const latestMonth = data[data.length - 1];

  if (!latestMonth) {
    return (
      <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {["CPI", "SPI", "CV", "SV"].map((label) => (
          <Badge
            key={label}
            variant="outline"
            className={cn(
              "h-auto justify-between rounded-md px-3 py-2 text-sm",
              toneClassNames.neutral
            )}
          >
            <span className="text-xs uppercase tracking-wide">{label}</span>
            <span className="font-semibold">--</span>
          </Badge>
        ))}
      </div>
    );
  }

  const cpi = latestMonth.actualCost === 0 ? 0 : latestMonth.earnedValue / latestMonth.actualCost;
  const spi =
    latestMonth.plannedValue === 0 ? 0 : latestMonth.earnedValue / latestMonth.plannedValue;
  const cv = latestMonth.earnedValue - latestMonth.actualCost;
  const sv = latestMonth.earnedValue - latestMonth.plannedValue;

  const metrics = [
    {
      label: "CPI",
      value: cpi.toFixed(2),
      tone: cpi >= 1 ? "positive" : "negative",
    },
    {
      label: "SPI",
      value: spi.toFixed(2),
      tone: spi >= 1 ? "positive" : "negative",
    },
    {
      label: "CV",
      value: currencyFormatter.format(cv),
      tone: getMetricTone(cv),
    },
    {
      label: "SV",
      value: currencyFormatter.format(sv),
      tone: getMetricTone(sv),
    },
  ] as const;

  return (
    <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
      {metrics.map((metric) => (
        <Badge
          key={metric.label}
          variant="outline"
          className={cn(
            "h-auto justify-between rounded-md px-3 py-2 text-sm",
            toneClassNames[metric.tone]
          )}
        >
          <span className="text-xs uppercase tracking-wide">{metric.label}</span>
          <span className="font-semibold">{metric.value}</span>
        </Badge>
      ))}
    </div>
  );
}
