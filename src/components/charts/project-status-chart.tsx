"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ProjectStatus, UnifiedProject } from "@/lib/data";

const STATUS_COLORS: Record<ProjectStatus, string> = {
  Active: "#f59e0b",
  "Pre-Construction": "#3b82f6",
  Completed: "#10b981",
  "On Hold": "#f97316",
};

const STATUSES: ProjectStatus[] = [
  "Active",
  "Pre-Construction",
  "Completed",
  "On Hold",
];

interface ProjectStatusChartProps {
  projects: UnifiedProject[];
  onSliceClick?: (slice: { name: ProjectStatus; value: number }) => void;
}

interface StatusSlice {
  name: ProjectStatus;
  value: number;
  color: string;
}

export function ProjectStatusChart({ projects, onSliceClick }: ProjectStatusChartProps) {
  const statusCounts = projects.reduce<Record<ProjectStatus, number>>(
    (acc, project) => {
      acc[project.status] += 1;
      return acc;
    },
    {
      Active: 0,
      "Pre-Construction": 0,
      Completed: 0,
      "On Hold": 0,
    }
  );

  const data: StatusSlice[] = STATUSES.map((status) => ({
    name: status,
    value: statusCounts[status],
    color: STATUS_COLORS[status],
  }));

  return (
    <div className="relative h-[300px] min-h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={72}
            outerRadius={104}
            paddingAngle={4}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.color}
                className="cursor-pointer"
                onClick={() => onSliceClick?.({ name: entry.name, value: entry.value })}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => {
              const count =
                typeof value === "number" && Number.isFinite(value)
                  ? value
                  : 0;

              return [`${count} ${count === 1 ? "project" : "projects"}`, "Count"];
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-3xl font-semibold text-foreground">{projects.length}</p>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Total Projects
          </p>
        </div>
      </div>
    </div>
  );
}
