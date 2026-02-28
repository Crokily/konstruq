import {
  parseDashboardContent,
  type ChartSpec,
  type KPIItem,
} from "@/lib/dashboard/types";

export type CustomDashboardWidgetType = "chart" | "kpi";

interface CustomDashboardWidgetBase {
  id: string;
  dashboardId: string;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomDashboardChartWidget extends CustomDashboardWidgetBase {
  widgetType: "chart";
  config: ChartSpec;
}

export interface CustomDashboardKpiWidget extends CustomDashboardWidgetBase {
  widgetType: "kpi";
  config: KPIItem;
}

export type CustomDashboardWidget =
  | CustomDashboardChartWidget
  | CustomDashboardKpiWidget;

export interface CustomDashboardDetail {
  id: string;
  name: string;
  description: string | null;
  projectId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  widgets: CustomDashboardWidget[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseWidget(value: unknown): CustomDashboardWidget | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = parseString(value.id);
  const dashboardId = parseString(value.dashboardId);
  const widgetType = parseString(value.widgetType);
  const title = parseString(value.title);
  const createdAt = parseString(value.createdAt);
  const updatedAt = parseString(value.updatedAt);

  if (
    !id ||
    !dashboardId ||
    !widgetType ||
    !title ||
    !createdAt ||
    !updatedAt ||
    typeof value.sortOrder !== "number" ||
    !Number.isFinite(value.sortOrder)
  ) {
    return null;
  }

  const baseWidget = {
    id,
    dashboardId,
    title,
    sortOrder: Math.max(0, Math.trunc(value.sortOrder)),
    createdAt,
    updatedAt,
  };

  if (widgetType === "chart") {
    const parsed = parseDashboardContent({ charts: [value.config] });
    const chart = parsed?.charts[0];

    if (!chart) {
      return null;
    }

    return {
      ...baseWidget,
      widgetType,
      config: {
        ...chart,
        id: `widget-${id}`,
        title,
      },
    };
  }

  if (widgetType === "kpi") {
    const parsed = parseDashboardContent({ kpis: [value.config] });
    const item = parsed?.kpis[0];

    if (!item) {
      return null;
    }

    return {
      ...baseWidget,
      widgetType,
      config: {
        ...item,
        label: title,
      },
    };
  }

  return null;
}

export function parseCustomDashboardDetail(
  value: unknown,
): CustomDashboardDetail | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = parseString(value.id);
  const name = parseString(value.name);
  const projectId = parseString(value.projectId);
  const status = parseString(value.status);
  const createdAt = parseString(value.createdAt);
  const updatedAt = parseString(value.updatedAt);

  if (!id || !name || !projectId || !status || !createdAt || !updatedAt) {
    return null;
  }

  const widgets = Array.isArray(value.widgets)
    ? value.widgets
        .map(parseWidget)
        .filter((widget): widget is CustomDashboardWidget => widget !== null)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  return {
    id,
    name,
    description: typeof value.description === "string" ? value.description : null,
    projectId,
    status,
    createdAt,
    updatedAt,
    widgets,
  };
}
