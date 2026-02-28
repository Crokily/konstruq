"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChangeOrder, ProjectFinancials } from "@/lib/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type ProjectFinancialOption = ProjectFinancials & {
  projectName: string;
};

interface ChangeOrderWaterfallProps {
  projectId: string;
  changeOrders: ChangeOrder[];
  projectFinancials: ProjectFinancialOption[];
}

interface WaterfallDatum {
  key: string;
  stepLabel: string;
  detailLabel: string;
  base: number;
  delta: number;
  labelValue: string;
  color: string;
}

function formatChangeValue(value: number): string {
  if (value > 0) {
    return `+${tooltipCurrencyFormatter.format(value)}`;
  }

  return tooltipCurrencyFormatter.format(value);
}

function WaterfallTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: WaterfallDatum }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0]?.payload;

  if (!point) {
    return null;
  }

  const isChangeOrder = point.key.startsWith("co-");
  const formattedValue = isChangeOrder
    ? formatChangeValue(point.delta)
    : tooltipCurrencyFormatter.format(point.delta);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
        {point.detailLabel}
      </p>
      <div className="flex items-center gap-2 text-sm">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: point.color }} />
        <span className="text-slate-300">{isChangeOrder ? "Change" : "Amount"}</span>
        <span className="ml-auto font-medium text-slate-100">{formattedValue}</span>
      </div>
    </div>
  );
}

export function ChangeOrderWaterfall({
  projectId,
  changeOrders,
  projectFinancials,
}: ChangeOrderWaterfallProps) {
  const sortedProjectFinancials = useMemo(
    () =>
      [...projectFinancials].sort((a, b) =>
        a.projectName.localeCompare(b.projectName)
      ),
    [projectFinancials]
  );

  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    const hasInitialProject = sortedProjectFinancials.some(
      (item) => item.projectId === projectId
    );

    if (hasInitialProject) {
      return projectId;
    }

    return sortedProjectFinancials[0]?.projectId ?? "";
  });

  const activeProjectId = sortedProjectFinancials.some(
    (item) => item.projectId === selectedProjectId
  )
    ? selectedProjectId
    : (sortedProjectFinancials[0]?.projectId ?? "");

  const selectedFinancials = sortedProjectFinancials.find(
    (item) => item.projectId === activeProjectId
  );

  const selectedChangeOrders = useMemo(
    () =>
      changeOrders
        .filter((order) => order.projectId === activeProjectId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [activeProjectId, changeOrders]
  );

  const chartData = useMemo<WaterfallDatum[]>(() => {
    if (!selectedFinancials) {
      return [];
    }

    const rows: WaterfallDatum[] = [
      {
        key: "original",
        stepLabel: "Original Contract",
        detailLabel: "Original Contract",
        base: 0,
        delta: selectedFinancials.originalContractAmount,
        labelValue: tooltipCurrencyFormatter.format(
          selectedFinancials.originalContractAmount
        ),
        color: "#3b82f6",
      },
    ];

    let cumulativeAmount = selectedFinancials.originalContractAmount;

    for (const order of selectedChangeOrders) {
      rows.push({
        key: order.id,
        stepLabel: order.number,
        detailLabel: `${order.number} • ${order.title}`,
        base: cumulativeAmount,
        delta: order.amount,
        labelValue: formatChangeValue(order.amount),
        color: order.amount >= 0 ? "#22c55e" : "#ef4444",
      });

      cumulativeAmount += order.amount;
    }

    rows.push({
      key: "revised",
      stepLabel: "Revised Total",
      detailLabel: "Revised Total",
      base: 0,
      delta: selectedFinancials.revisedContractAmount,
      labelValue: tooltipCurrencyFormatter.format(
        selectedFinancials.revisedContractAmount
      ),
      color: "#f59e0b",
    });

    return rows;
  }, [selectedChangeOrders, selectedFinancials]);

  if (sortedProjectFinancials.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 px-4 py-10 text-center text-sm text-slate-400">
        No change-order financial data available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:max-w-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Select Project
        </p>
        <Select value={activeProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-full border-slate-700 bg-slate-900/60 text-slate-100">
            <SelectValue placeholder="Choose project" />
          </SelectTrigger>
          <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
            {sortedProjectFinancials.map((financials) => (
              <SelectItem key={financials.projectId} value={financials.projectId}>
                {financials.projectName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-[350px] min-h-[350px] w-full [&_.recharts-cartesian-axis-tick-value]:fill-slate-400 [&_.recharts-cartesian-grid_line]:stroke-slate-800">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 24, right: 12, left: 8, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
            <XAxis dataKey="stepLabel" tickLine={false} axisLine={false} interval={0} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => axisCurrencyFormatter.format(value)}
            />
            <ReferenceLine y={0} stroke="#64748b" strokeOpacity={0.55} />
            <Tooltip content={<WaterfallTooltip />} />
            <Bar dataKey="base" stackId="waterfall" fill="transparent" />
            <Bar dataKey="delta" stackId="waterfall" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="labelValue" position="top" className="fill-slate-300 text-[11px]" />
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
