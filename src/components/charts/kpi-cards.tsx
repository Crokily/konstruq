"use client";

import {
  AlertTriangle,
  Building2,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PortfolioKPIs } from "@/lib/data";
import { cn } from "@/lib/utils";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
});

interface KPICardsProps {
  kpis: PortfolioKPIs;
}

export function KPICards({ kpis }: KPICardsProps) {
  const cards = [
    {
      title: "Active Projects",
      value: String(kpis.activeProjectsCount),
      subtitle: "Currently in execution",
      icon: Building2,
      iconColor: "text-amber-500",
      iconBg: "bg-amber-500/15",
      valueColor: "text-foreground",
    },
    {
      title: "Total Contract Value",
      value: currencyFormatter.format(kpis.totalContractValue),
      subtitle: "Across active projects",
      icon: DollarSign,
      iconColor: "text-emerald-500",
      iconBg: "bg-emerald-500/15",
      valueColor: "text-foreground",
    },
    {
      title: "Avg CPI",
      value: kpis.avgCpi.toFixed(2),
      subtitle: kpis.avgCpi >= 1 ? "Cost performance on target" : "Cost pressure detected",
      icon: TrendingUp,
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/15",
      valueColor: kpis.avgCpi >= 1 ? "text-emerald-400" : "text-rose-400",
    },
    {
      title: "At Risk Projects",
      value: String(kpis.atRiskCount),
      subtitle: "CPI or SPI below 0.95",
      icon: AlertTriangle,
      iconColor: "text-red-500",
      iconBg: "bg-red-500/15",
      valueColor: "text-foreground",
    },
  ] as const;

  return (
    <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
      {cards.map((card) => (
        <Card key={card.title} className="border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{card.title}</p>
            <span
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-lg",
                card.iconBg,
                card.iconColor
              )}
            >
              <card.icon className="h-5 w-5" />
            </span>
          </div>
          <p className={cn("text-3xl font-semibold tracking-tight", card.valueColor)}>
            {card.value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{card.subtitle}</p>
        </Card>
      ))}
    </div>
  );
}
