"use client";

import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { ProjectHealthMatrixItem, UnifiedProject } from "@/lib/data";

interface ProjectHealthScatterProps {
  matrix: ProjectHealthMatrixItem[];
  projects: UnifiedProject[];
}

interface ScatterDatum {
  id: string;
  name: string;
  schedulePercent: number;
  budgetPercent: number;
  contractValue: number;
  healthLabel: "On Track" | "At Risk" | "Over Budget";
  color: string;
}

const contractValueFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function getHealthCategory(schedulePercent: number, budgetPercent: number): {
  label: ScatterDatum["healthLabel"];
  color: string;
} {
  const variance = Math.abs(schedulePercent - budgetPercent);

  if (variance <= 10) {
    return { label: "On Track", color: "#10b981" };
  }

  if (variance <= 20) {
    return { label: "At Risk", color: "#f59e0b" };
  }

  return { label: "Over Budget", color: "#ef4444" };
}

function ProjectHealthTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ScatterDatum }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0]?.payload;

  if (!point) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur">
      <p className="mb-2 text-sm font-semibold text-slate-100">{point.name}</p>
      <div className="space-y-1 text-xs text-slate-300">
        <p>
          Schedule: <span className="font-medium text-slate-100">{point.schedulePercent}%</span>
        </p>
        <p>
          Budget: <span className="font-medium text-slate-100">{point.budgetPercent}%</span>
        </p>
        <p>
          Contract Value:{" "}
          <span className="font-medium text-slate-100">
            {contractValueFormatter.format(point.contractValue)}
          </span>
        </p>
        <p>
          Health: <span className="font-medium text-slate-100">{point.healthLabel}</span>
        </p>
      </div>
    </div>
  );
}

export function ProjectHealthScatter({ matrix, projects }: ProjectHealthScatterProps) {
  const contractValueByProject = new Map(
    projects.map((project) => [project.id, project.totalValue])
  );

  const chartData: ScatterDatum[] = matrix.map((item) => {
    const health = getHealthCategory(item.schedulePercent, item.budgetPercent);

    return {
      id: item.projectId,
      name: item.name,
      schedulePercent: item.schedulePercent,
      budgetPercent: item.budgetPercent,
      contractValue: contractValueByProject.get(item.projectId) ?? 0,
      healthLabel: health.label,
      color: health.color,
    };
  });

  return (
    <div className="h-[350px] min-h-[350px] w-full [&_.recharts-cartesian-axis-tick-value]:fill-slate-400 [&_.recharts-cartesian-grid_line]:stroke-slate-800">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
          <XAxis
            type="number"
            dataKey="schedulePercent"
            name="Schedule % Complete"
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="number"
            dataKey="budgetPercent"
            name="Budget % Spent"
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
          />
          <ZAxis
            type="number"
            dataKey="contractValue"
            name="Contract Value"
            range={[120, 900]}
          />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: 100, y: 100 },
            ]}
            stroke="#94a3b8"
            strokeDasharray="5 5"
          />
          <Tooltip content={<ProjectHealthTooltip />} cursor={{ stroke: "#64748b" }} />
          <Scatter data={chartData}>
            {chartData.map((entry) => (
              <Cell key={entry.id} fill={entry.color} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
