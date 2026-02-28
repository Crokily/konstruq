"use client";

import { useMemo, useState } from "react";
import { Building2, CalendarDays, Database, LayoutGrid, ShieldCheck } from "lucide-react";
import type {
  PortfolioKPIs,
  ProjectHealthMatrixItem,
  RevenueExpenseTrendPoint,
  UnifiedProject,
} from "@/lib/data";
import { KPICards } from "@/components/charts/kpi-cards";
import { ProjectHealthScatter } from "@/components/charts/project-health-scatter";
import { ProjectStatusChart } from "@/components/charts/project-status-chart";
import { ProjectTable } from "@/components/charts/project-table";
import { RevenueExpenseChart } from "@/components/charts/revenue-expense-chart";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DashboardTemplate = "executive" | "delivery" | "finance";
export type DatasetCategory = "pm" | "erp";

export interface DatasetSheetRef {
  sheetName: string;
  columns: string[];
  rowCount: number;
}

export interface UploadedDatasetRef {
  id: string;
  category: DatasetCategory;
  fileName: string;
  uploadedAt: string;
  sheets: DatasetSheetRef[];
}

interface ChartPointSelection {
  chartId: "project-status" | "revenue-expense" | "project-health";
  label: string;
  primaryMetric?: string;
  projectId?: string;
}

interface DashboardWorkspaceProps {
  userFirstName?: string | null;
  kpis: PortfolioKPIs;
  projects: UnifiedProject[];
  revenueExpenseTrend: RevenueExpenseTrendPoint[];
  projectHealthMatrix: ProjectHealthMatrixItem[];
  datasetReferences: UploadedDatasetRef[];
}

const templateMeta: Record<DashboardTemplate, { label: string; description: string }> = {
  executive: {
    label: "Executive Overview",
    description: "Portfolio KPI tracking and risk signals for leadership.",
  },
  delivery: {
    label: "Project Delivery",
    description: "Schedule, budget health, and project-level performance.",
  },
  finance: {
    label: "Financial Control",
    description: "Revenue, expense trends, and ERP-aligned monitoring.",
  },
};

const chartToCategory: Record<ChartPointSelection["chartId"], DatasetCategory> = {
  "project-status": "pm",
  "project-health": "pm",
  "revenue-expense": "erp",
};

function matchKeywords(selection: ChartPointSelection): string[] {
  if (selection.chartId === "project-status") {
    return ["status", "stage", "project", selection.label.toLowerCase()];
  }

  if (selection.chartId === "project-health") {
    return ["schedule", "budget", "percent", "health", selection.label.toLowerCase()];
  }

  return ["revenue", "expense", "cost", "month", selection.label.toLowerCase()];
}

export function DashboardWorkspace({
  userFirstName,
  kpis,
  projects,
  revenueExpenseTrend,
  projectHealthMatrix,
  datasetReferences,
}: DashboardWorkspaceProps) {
  const [template, setTemplate] = useState<DashboardTemplate>("executive");
  const [selection, setSelection] = useState<ChartPointSelection | null>(null);

  const referenceCandidates = useMemo(() => {
    if (!selection) {
      return [];
    }

    const category = chartToCategory[selection.chartId];
    const keywords = matchKeywords(selection);

    return datasetReferences
      .filter((item) => item.category === category)
      .map((item) => {
        const matchedColumns = item.sheets.flatMap((sheet) =>
          sheet.columns.filter((column) => {
            const normalized = column.toLowerCase();
            return keywords.some((keyword) => normalized.includes(keyword));
          })
        );

        return {
          ...item,
          matchedColumns,
          score: matchedColumns.length,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [datasetReferences, selection]);

  const portfolioConnected = {
    pm: datasetReferences.some((item) => item.category === "pm"),
    erp: datasetReferences.some((item) => item.category === "erp"),
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Dashboard Workspace</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {templateMeta[template].label}
            </h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {userFirstName || "there"}. {templateMeta[template].description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={template} onValueChange={(value) => setTemplate(value as DashboardTemplate)}>
              <SelectTrigger className="w-[220px]">
                <LayoutGrid className="h-4 w-4" />
                <SelectValue placeholder="Select dashboard" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="executive">Executive Overview</SelectItem>
                <SelectItem value="delivery">Project Delivery</SelectItem>
                <SelectItem value="finance">Financial Control</SelectItem>
              </SelectContent>
            </Select>

            <Badge variant="outline" className="gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              FY 2026
            </Badge>
            <Badge variant={portfolioConnected.pm ? "default" : "outline"} className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              PM {portfolioConnected.pm ? "Connected" : "Pending"}
            </Badge>
            <Badge variant={portfolioConnected.erp ? "default" : "outline"} className="gap-1.5">
              <Database className="h-3.5 w-3.5" />
              ERP {portfolioConnected.erp ? "Connected" : "Pending"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <KPICards kpis={kpis} />

      {template === "executive" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle>Project Status</CardTitle>
                <CardDescription>Distribution by current stage</CardDescription>
              </CardHeader>
              <CardContent>
                <ProjectStatusChart
                  projects={projects}
                  onSliceClick={(status) =>
                    setSelection({ chartId: "project-status", label: status.name, primaryMetric: "count" })
                  }
                />
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle>Revenue vs Expenses</CardTitle>
                <CardDescription>Rolling 12-month trend</CardDescription>
              </CardHeader>
              <CardContent>
                <RevenueExpenseChart
                  data={revenueExpenseTrend}
                  onPointClick={(point) =>
                    setSelection({
                      chartId: "revenue-expense",
                      label: point.monthLabel,
                      primaryMetric: point.metric,
                    })
                  }
                />
              </CardContent>
            </Card>
          </div>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle>Project Health Matrix</CardTitle>
              <CardDescription>Schedule completion compared to budget burn</CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectHealthScatter
                matrix={projectHealthMatrix}
                projects={projects}
                onPointClick={(point) =>
                  setSelection({
                    chartId: "project-health",
                    label: point.name,
                    projectId: point.id,
                    primaryMetric: "variance",
                  })
                }
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {template === "delivery" ? (
        <div className="grid grid-cols-1 gap-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle>Project Health Matrix</CardTitle>
              <CardDescription>Click a point to inspect source dataset references</CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectHealthScatter
                matrix={projectHealthMatrix}
                projects={projects}
                onPointClick={(point) =>
                  setSelection({
                    chartId: "project-health",
                    label: point.name,
                    projectId: point.id,
                    primaryMetric: "variance",
                  })
                }
              />
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-0">
              <CardTitle>Project Register</CardTitle>
              <CardDescription>ERP-grade sortable register with budget/schedule status</CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectTable projects={projects} matrix={projectHealthMatrix} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {template === "finance" ? (
        <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
          <Card className="border-border bg-card xl:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle>Revenue vs Expenses</CardTitle>
              <CardDescription>Click a point to trace the ERP source references</CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueExpenseChart
                data={revenueExpenseTrend}
                onPointClick={(point) =>
                  setSelection({
                    chartId: "revenue-expense",
                    label: point.monthLabel,
                    primaryMetric: point.metric,
                  })
                }
              />
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle>Project Status</CardTitle>
              <CardDescription>Execution portfolio split by stage</CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectStatusChart
                projects={projects}
                onSliceClick={(status) =>
                  setSelection({ chartId: "project-status", label: status.name, primaryMetric: "count" })
                }
              />
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle>Data Reference Intelligence</CardTitle>
              <CardDescription>Uploaded source linkage for clicked chart points</CardDescription>
            </CardHeader>
            <CardContent>
              <ReferencePanel selection={selection} references={referenceCandidates} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {template !== "finance" ? (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Data Reference Intelligence
            </CardTitle>
            <CardDescription>
              Click chart points to view candidate source files from uploaded datasets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReferencePanel selection={selection} references={referenceCandidates} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ReferencePanel({
  selection,
  references,
}: {
  selection: ChartPointSelection | null;
  references: Array<UploadedDatasetRef & { matchedColumns: string[]; score: number }>;
}) {
  if (!selection) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
        No point selected yet. Click a pie slice, line area point, or scatter bubble to inspect its source references.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected Point</p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {selection.chartId} · {selection.label}
          {selection.primaryMetric ? ` · ${selection.primaryMetric}` : ""}
        </p>
      </div>

      {references.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No uploaded reference files found for this chart domain. Upload PM/ERP files in Data Sources.
        </p>
      ) : (
        <div className="max-h-80 space-y-3 overflow-auto pr-1">
          {references.map((reference) => (
            <div key={reference.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{reference.fileName}</p>
                <Badge variant="outline">{reference.category.toUpperCase()}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Uploaded {new Date(reference.uploadedAt).toLocaleString()} · {reference.sheets.length} sheets
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Matched columns: {reference.matchedColumns.length > 0 ? reference.matchedColumns.join(", ") : "No direct column match"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
