import { auth } from "@clerk/nextjs/server";
import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { buildDatasetsContext, MAX_DATA_TOKENS } from "@/lib/ai/dataset-context";
import { resolveAppUserId } from "@/lib/db/app-user";
import { db } from "@/lib/db";
import { customDashboards, dashboardWidgets } from "@/lib/db/schema";
import {
  callDashboardLLM,
  DashboardGenerationError,
  fetchUserDatasets,
  parseJsonResponse,
} from "@/lib/dashboard/generate";
import { parseDashboardContent } from "@/lib/dashboard/types";

interface DashboardRefreshRouteContext {
  params: Promise<{ id: string }>;
}

interface DashboardWidgetRow {
  id: string;
  dashboardId: string;
  widgetType: string;
  title: string;
  config: unknown;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface WidgetRefreshFailure {
  widgetId: string;
  title: string;
  error: string;
}

type RefreshableWidgetType = "chart" | "kpi";

const REFRESH_PREVIEW_ROW_LIMIT = 30;

const CHART_REFRESH_SYSTEM_PROMPT = [
  "You are a data analytics assistant refreshing one saved dashboard chart with the latest uploaded project data.",
  "Return ONLY valid JSON with no markdown code fences and no explanation outside the JSON.",
  "",
  "Output schema:",
  "{",
  '  "type": "bar"|"line"|"area"|"pie"|"scatter",',
  '  "title": string,',
  '  "group"?: string,',
  '  "data": [...],',
  '  "xKey"?: string,',
  '  "yKeys"?: string[],',
  '  "nameKey"?: string,',
  '  "valueKey"?: string,',
  '  "colors": string[],',
  '  "methodology"?: {',
  '    "formula"?: string,',
  '    "description"?: string,',
  '    "assumptions"?: string[]',
  "  }",
  "}",
  "",
  "Rules:",
  "- Keep the same analytical focus as the saved widget while using the latest data only.",
  "- Use only columns and values that actually exist in the provided datasets.",
  "- Generate 5-25 data points. Aggregate if the raw data has more rows.",
  '- For pie charts, include "nameKey" and "valueKey".',
  '- For non-pie charts, include "xKey" and at least one "yKeys" entry.',
  '- For scatter charts, use exactly one "yKeys" entry and ensure "xKey" is numeric.',
  '- Color palette: ["#4f46e5","#06b6d4","#10b981","#f59e0b","#ef4444","#8b5cf6"]',
  "- The data array must contain plain JSON objects only.",
].join("\n");

const KPI_REFRESH_SYSTEM_PROMPT = [
  "You are a data analytics assistant refreshing one saved dashboard KPI with the latest uploaded project data.",
  "Return ONLY valid JSON with no markdown code fences and no explanation outside the JSON.",
  "",
  "Output schema:",
  "{",
  '  "label": string,',
  '  "value": number|string,',
  '  "format": "currency"|"percentage"|"number"|"text",',
  '  "description": string',
  "}",
  "",
  "Rules:",
  "- Keep the same analytical focus as the saved widget while using the latest data only.",
  "- Use only columns and values that actually exist in the provided datasets.",
  "- Prefer numeric values when the data supports them.",
  '- Use format "currency" for money, "percentage" for rates, "number" for counts/aggregates, and "text" only when numeric output is not trustworthy.',
].join("\n");

export const maxDuration = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRefreshableWidgetType(value: string): value is RefreshableWidgetType {
  return value === "chart" || value === "kpi";
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return "Widget refresh failed";
}

function buildWidgetFocusContext(widget: DashboardWidgetRow): string | null {
  if (!isRecord(widget.config)) {
    return null;
  }

  if (widget.widgetType === "chart") {
    const summary = {
      chartType: typeof widget.config.type === "string" ? widget.config.type : undefined,
      xKey: typeof widget.config.xKey === "string" ? widget.config.xKey : undefined,
      yKeys: parseStringArray(widget.config.yKeys),
      nameKey:
        typeof widget.config.nameKey === "string" ? widget.config.nameKey : undefined,
      valueKey:
        typeof widget.config.valueKey === "string" ? widget.config.valueKey : undefined,
      methodology: isRecord(widget.config.methodology)
        ? widget.config.methodology
        : undefined,
    };
    const serialized = JSON.stringify(summary);

    return serialized === "{}" ? null : serialized;
  }

  const summary = {
    format: typeof widget.config.format === "string" ? widget.config.format : undefined,
    description:
      typeof widget.config.description === "string"
        ? widget.config.description
        : undefined,
  };
  const serialized = JSON.stringify(summary);

  return serialized === "{}" ? null : serialized;
}

function buildRefreshUserPrompt(
  widget: DashboardWidgetRow,
  datasetsContext: string,
): string {
  const sections = [
    `Regenerate this chart/KPI with the latest data. Original title: ${widget.title}. Original type: ${widget.widgetType}. Maintain the same analytical focus but use current data.`,
    "Preserve the current saved title concept and top-level widget kind.",
  ];
  const widgetFocusContext = buildWidgetFocusContext(widget);

  if (widgetFocusContext) {
    sections.push(`Existing widget context: ${widgetFocusContext}`);
  }

  sections.push(datasetsContext);

  return sections.join("\n\n");
}

async function getOwnedDashboard(appUserId: string, dashboardId: string) {
  const [dashboard] = await db
    .select({
      id: customDashboards.id,
      projectId: customDashboards.projectId,
    })
    .from(customDashboards)
    .where(
      and(
        eq(customDashboards.id, dashboardId),
        eq(customDashboards.userId, appUserId),
        eq(customDashboards.status, "active"),
      ),
    )
    .limit(1);

  return dashboard ?? null;
}

async function listDashboardWidgets(
  dashboardId: string,
): Promise<DashboardWidgetRow[]> {
  return db
    .select({
      id: dashboardWidgets.id,
      dashboardId: dashboardWidgets.dashboardId,
      widgetType: dashboardWidgets.widgetType,
      title: dashboardWidgets.title,
      config: dashboardWidgets.config,
      sortOrder: dashboardWidgets.sortOrder,
      createdAt: dashboardWidgets.createdAt,
      updatedAt: dashboardWidgets.updatedAt,
    })
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.dashboardId, dashboardId))
    .orderBy(asc(dashboardWidgets.sortOrder));
}

async function generateRefreshedWidgetConfig(widget: DashboardWidgetRow, datasets: string) {
  if (!isRefreshableWidgetType(widget.widgetType)) {
    throw new Error(`Unsupported widget type: ${widget.widgetType}`);
  }

  const responseText = await callDashboardLLM(
    widget.widgetType === "chart"
      ? CHART_REFRESH_SYSTEM_PROMPT
      : KPI_REFRESH_SYSTEM_PROMPT,
    buildRefreshUserPrompt(widget, datasets),
  );
  const parsedResponse = parseJsonResponse(responseText);

  if (widget.widgetType === "chart") {
    const chart = parseDashboardContent({ charts: [parsedResponse] })?.charts[0];

    if (!chart) {
      throw new Error("AI response did not contain a valid chart configuration");
    }

    return {
      ...chart,
      title: widget.title,
    };
  }

  const kpi = parseDashboardContent({ kpis: [parsedResponse] })?.kpis[0];

  if (!kpi) {
    throw new Error("AI response did not contain a valid KPI configuration");
  }

  return {
    ...kpi,
    label: widget.title,
  };
}

export async function POST(
  _request: NextRequest,
  { params }: DashboardRefreshRouteContext,
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.MISTRAL_API_KEY) {
      return NextResponse.json(
        { error: "MISTRAL_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const appUserId = await resolveAppUserId(userId);

    if (!appUserId) {
      return NextResponse.json(
        { error: "Unable to resolve user" },
        { status: 500 },
      );
    }

    const { id } = await params;
    const dashboardId = id.trim();

    if (!dashboardId) {
      return NextResponse.json({ error: "Invalid dashboard id" }, { status: 400 });
    }

    const dashboard = await getOwnedDashboard(appUserId, dashboardId);

    if (!dashboard) {
      return NextResponse.json(
        { error: "Custom dashboard not found" },
        { status: 404 },
      );
    }

    const widgets = await listDashboardWidgets(dashboard.id);

    if (widgets.length === 0) {
      return NextResponse.json({
        refreshed: 0,
        failed: 0,
        widgets,
        errors: [],
      });
    }

    const datasets = await fetchUserDatasets(appUserId, dashboard.projectId);

    if (datasets.length === 0) {
      const errors = widgets.map(
        (widget): WidgetRefreshFailure => ({
          widgetId: widget.id,
          title: widget.title,
          error: "No active datasets are available for this project.",
        }),
      );

      return NextResponse.json({
        refreshed: 0,
        failed: errors.length,
        widgets,
        errors,
      });
    }

    const datasetsContext = buildDatasetsContext(datasets, {
      previewRowLimit: REFRESH_PREVIEW_ROW_LIMIT,
      maxDataTokens: MAX_DATA_TOKENS,
    });

    const settledResults = await Promise.allSettled(
      widgets.map(async (widget) => {
        const config = await generateRefreshedWidgetConfig(widget, datasetsContext);

        await db
          .update(dashboardWidgets)
          .set({
            config,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(dashboardWidgets.id, widget.id),
              eq(dashboardWidgets.dashboardId, dashboard.id),
            ),
          );

        return widget.id;
      }),
    );

    const errors: WidgetRefreshFailure[] = [];
    let refreshed = 0;

    for (const [index, result] of settledResults.entries()) {
      if (result.status === "fulfilled") {
        refreshed += 1;
        continue;
      }

      const widget = widgets[index];

      errors.push({
        widgetId: widget.id,
        title: widget.title,
        error: toErrorMessage(result.reason),
      });
    }

    if (refreshed > 0) {
      await db
        .update(customDashboards)
        .set({ updatedAt: new Date() })
        .where(eq(customDashboards.id, dashboard.id));
    }

    const refreshedWidgets = await listDashboardWidgets(dashboard.id);

    return NextResponse.json({
      refreshed,
      failed: errors.length,
      widgets: refreshedWidgets,
      errors,
    });
  } catch (error) {
    if (error instanceof DashboardGenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Custom dashboard refresh POST route failed:", error);
    return NextResponse.json(
      { error: "Unable to refresh dashboard widgets right now" },
      { status: 500 },
    );
  }
}
