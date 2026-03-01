"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "ai/react";
import {
  AlertTriangle,
  Bot,
  ChevronRight,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";

import type {
  MessageKpiItem,
  MessageWidgetAddRequest,
  MessageWidgetAddState,
} from "@/components/chat/message-renderer";
import { ChatThread } from "@/components/chat/page/chat-thread";
import { ChatComposer } from "@/components/chat/page/chat-composer";
import { ChartDataTable, getChartDataTableColumns } from "@/components/charts/chart-data-table";
import { DynamicChart } from "@/components/charts/dynamic-chart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CHART_STYLE_SPEC,
  type ChartSpec as AssistantChartSpec,
  type SupportedChartType,
} from "@/lib/charting/spec";
import type {
  CustomDashboardChartWidget,
  CustomDashboardDetail,
  CustomDashboardKpiWidget,
  CustomDashboardWidget,
} from "@/lib/dashboard/custom-dashboard";
import {
  parseCustomDashboardDetail,
} from "@/lib/dashboard/custom-dashboard";
import type { ChartType, KPIItem } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

interface CustomDashboardCanvasProps {
  dashboard: CustomDashboardDetail;
  projectId: string;
  projectName: string;
}

interface ApiErrorPayload {
  error?: string;
}

interface WidgetRefreshFailurePayload {
  widgetId: string;
  title?: string;
  error: string;
}

interface StreamingAssistantMessage {
  toolInvocations?: Array<{
    toolName: string;
    state: "call" | "partial-call" | "result";
  }>;
}

const DASHBOARD_ASSISTANT_SUGGESTIONS = [
  "Create a KPI widget for the most important project health metric in the data.",
  "Create a chart widget that highlights the biggest schedule risk trend.",
  "Create the best first widget for this dashboard based on the uploaded datasets.",
] as const;

const TOOL_STATUS_LABELS: Record<string, string> = {
  aggregateColumn: "Calculating aggregates...",
  getDatasetSchema: "Reading schema...",
  listDatasets: "Scanning datasets...",
  queryDatasetRows: "Querying data...",
  searchDatasets: "Searching datasets...",
};
const ADD_WIDGET_SUCCESS_DURATION_MS = 1200;

interface CreateDashboardWidgetRequest {
  widgetType: "chart" | "kpi";
  title: string;
  config: Record<string, unknown>;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function formatKPIValue(item: KPIItem): string {
  if (typeof item.value === "string") {
    return item.value;
  }

  if (item.format === "currency") {
    return currencyFormatter.format(item.value);
  }

  if (item.format === "percentage") {
    const percentageValue =
      Math.abs(item.value) <= 1 ? item.value * 100 : item.value;

    return `${numberFormatter.format(percentageValue)}%`;
  }

  if (item.format === "number") {
    return numberFormatter.format(item.value);
  }

  return String(item.value);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function sanitizeStreamingAssistantContent(content: string): string {
  const completeBlocksRemoved = content.replace(/```(chart|table|kpi)\n[\s\S]*?```/g, "");
  const trailingBlockStart = completeBlocksRemoved.search(
    /```(chart|table|kpi)\n[\s\S]*$/,
  );
  const safeText =
    trailingBlockStart >= 0
      ? completeBlocksRemoved.slice(0, trailingBlockStart)
      : completeBlocksRemoved;

  return safeText.trim();
}

function mapAssistantChartTypeToDashboardType(
  type: SupportedChartType,
): ChartType {
  if (type === "stacked-bar") {
    return "bar";
  }

  if (type === "composed") {
    return "line";
  }

  return type;
}

function buildDashboardChartConfig(
  spec: AssistantChartSpec,
): Record<string, unknown> {
  const type = mapAssistantChartTypeToDashboardType(spec.type);
  const colors = spec.metrics.map(
    (metric, index) =>
      metric.color ??
      CHART_STYLE_SPEC.palette[index % CHART_STYLE_SPEC.palette.length],
  );

  if (type === "pie") {
    return {
      ...spec,
      originalType: spec.type,
      type,
      nameKey: spec.xAxisKey,
      valueKey: spec.metrics[0]?.key ?? spec.xAxisKey,
      colors,
    };
  }

  return {
    ...spec,
    originalType: spec.type,
    type,
    xKey: spec.xAxisKey,
    yKeys:
      type === "scatter"
        ? spec.metrics.slice(0, 1).map((metric) => metric.key)
        : spec.metrics.map((metric) => metric.key),
    colors,
  };
}

function buildDashboardKpiConfig(item: MessageKpiItem): Record<string, unknown> {
  const format: KPIItem["format"] = "text";

  return {
    ...item,
    format,
  };
}

function buildCreateWidgetRequest(
  widget: MessageWidgetAddRequest,
): CreateDashboardWidgetRequest {
  if (widget.kind === "chart") {
    return {
      widgetType: "chart",
      title: widget.title,
      config: buildDashboardChartConfig(widget.spec),
    };
  }

  return {
    widgetType: "kpi",
    title: widget.title,
    config: buildDashboardKpiConfig(widget.item),
  };
}

function parseCreatedWidget(
  payload: unknown,
  dashboard: CustomDashboardDetail,
): CustomDashboardWidget | null {
  return (
    parseCustomDashboardDetail({
      ...dashboard,
      widgets: [payload],
    })?.widgets[0] ?? null
  );
}

function upsertWidget(
  current: CustomDashboardWidget[],
  nextWidget: CustomDashboardWidget,
): CustomDashboardWidget[] {
  return [...current.filter((widget) => widget.id !== nextWidget.id), nextWidget]
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function getChartDescription(type: CustomDashboardChartWidget["config"]["type"]) {
  if (type === "pie") {
    return "Saved distribution view";
  }

  if (type === "scatter") {
    return "Saved relationship view";
  }

  return "Saved trend and comparison view";
}

function parseRefreshFailures(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) {
    return {};
  }

  return value.reduce<Record<string, string>>((accumulator, item) => {
    if (
      typeof item === "object" &&
      item !== null &&
      "widgetId" in item &&
      "error" in item
    ) {
      const widgetId =
        typeof item.widgetId === "string" ? item.widgetId.trim() : "";
      const error = typeof item.error === "string" ? item.error.trim() : "";

      if (widgetId.length > 0 && error.length > 0) {
        accumulator[widgetId] = error;
      }
    }

    return accumulator;
  }, {});
}

function parseRefreshResponse(
  payload: unknown,
  dashboard: CustomDashboardDetail,
): {
  failed: number;
  refreshed: number;
  widgetErrors: Record<string, string>;
  widgets: CustomDashboardWidget[];
} | null {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("failed" in payload) ||
    !("refreshed" in payload) ||
    !("widgets" in payload) ||
    typeof payload.failed !== "number" ||
    !Number.isFinite(payload.failed) ||
    typeof payload.refreshed !== "number" ||
    !Number.isFinite(payload.refreshed) ||
    !Array.isArray(payload.widgets)
  ) {
    return null;
  }

  const parsedDashboard = parseCustomDashboardDetail({
    ...dashboard,
    widgets: payload.widgets,
  });

  if (!parsedDashboard) {
    return null;
  }

  return {
    failed: Math.max(0, Math.trunc(payload.failed)),
    refreshed: Math.max(0, Math.trunc(payload.refreshed)),
    widgetErrors: parseRefreshFailures(
      "errors" in payload ? payload.errors : undefined,
    ),
    widgets: parsedDashboard.widgets,
  };
}

function DashboardWidgetDeleteButton({
  disabled,
  onDelete,
}: {
  disabled: boolean;
  onDelete: () => void;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      onClick={onDelete}
      disabled={disabled}
      aria-label="Delete widget"
      className="h-8 w-8"
    >
      {disabled ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

function WidgetRefreshErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function CustomDashboardKpiCard({
  widget,
  deleting,
  refreshError,
  refreshing,
  onDelete,
}: {
  widget: CustomDashboardKpiWidget;
  deleting: boolean;
  refreshError?: string;
  refreshing: boolean;
  onDelete: () => void;
}) {
  const accentStyles = [
    "from-amber-500/16 to-amber-500/0 border-amber-500/15",
    "from-cyan-500/16 to-cyan-500/0 border-cyan-500/15",
    "from-emerald-500/16 to-emerald-500/0 border-emerald-500/15",
    "from-rose-500/16 to-rose-500/0 border-rose-500/15",
    "from-violet-500/16 to-violet-500/0 border-violet-500/15",
  ] as const;

  return (
    <Card
      className={cn(
        "gap-4 overflow-hidden border bg-card/95 py-5",
        "bg-gradient-to-br",
        accentStyles[widget.sortOrder % accentStyles.length],
      )}
    >
      <CardContent className="px-5">
        {refreshing ? (
          <div className="flex min-h-24 items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Refreshing KPI...
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{widget.config.label}</p>
                <p className="text-3xl font-semibold tracking-tight text-foreground">
                  {formatKPIValue(widget.config)}
                </p>
              </div>
              <DashboardWidgetDeleteButton
                disabled={deleting}
                onDelete={onDelete}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {widget.config.description ??
                "Saved KPI derived from the datasets attached to this project."}
            </p>
            {refreshError ? <WidgetRefreshErrorBanner message={refreshError} /> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CustomDashboardChartCard({
  widget,
  deleting,
  refreshError,
  refreshing,
  onDelete,
}: {
  widget: CustomDashboardChartWidget;
  deleting: boolean;
  refreshError?: string;
  refreshing: boolean;
  onDelete: () => void;
}) {
  const columns = getChartDataTableColumns(widget.config);

  return (
    <Card className="border-border bg-card py-0">
      <CardHeader className="pb-4 pt-6">
        <div className="flex items-start justify-between gap-3">
          {refreshing ? (
            <div className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Refreshing chart...
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <CardTitle>{widget.title}</CardTitle>
                <CardDescription>
                  {getChartDescription(widget.config.type)}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {widget.config.type}
                </span>
                <DashboardWidgetDeleteButton
                  disabled={deleting}
                  onDelete={onDelete}
                />
              </div>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-6">
        {refreshing ? (
          <div className="flex min-h-72 items-center justify-center rounded-lg border border-border/60 bg-background">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Loading chart...
            </div>
          </div>
        ) : (
          <>
            <Tabs defaultValue="chart" className="w-full gap-3">
              <TabsList>
                <TabsTrigger value="chart">Chart</TabsTrigger>
                <TabsTrigger value="table">Table</TabsTrigger>
              </TabsList>
              <TabsContent
                value="chart"
                forceMount
                className="mt-0 data-[state=inactive]:hidden"
              >
                <DynamicChart chart={widget.config} />
              </TabsContent>
              <TabsContent
                value="table"
                forceMount
                className="mt-0 data-[state=inactive]:hidden"
              >
                <ChartDataTable
                  columns={columns}
                  data={widget.config.data}
                  rowKeyPrefix={widget.id}
                />
              </TabsContent>
            </Tabs>
            {refreshError ? <WidgetRefreshErrorBanner message={refreshError} /> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AssistantSheet({
  dashboard,
  open,
  onOpenChange,
  onAddWidget,
  getAddWidgetState,
}: {
  dashboard: CustomDashboardDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddWidget: (widget: MessageWidgetAddRequest) => void | Promise<void>;
  getAddWidgetState: (blockKey: string) => MessageWidgetAddState;
}) {
  const {
    append,
    error,
    handleInputChange,
    handleSubmit,
    input,
    isLoading,
    messages,
    reload,
  } = useChat({
    api: `/api/custom-dashboards/${dashboard.id}/chat`,
    id: `custom-dashboard-assistant:${dashboard.id}`,
    keepLastMessageOnError: true,
  });

  const visibleMessages = useMemo(
    () =>
      messages.map((message, index) => {
        const isStreamingAssistant =
          isLoading &&
          index === messages.length - 1 &&
          message.role === "assistant";

        if (!isStreamingAssistant || typeof message.content !== "string") {
          return message;
        }

        const sanitized = sanitizeStreamingAssistantContent(message.content);
        return {
          ...message,
          content: sanitized.length > 0 ? sanitized : "Generating...",
        };
      }),
    [isLoading, messages],
  );

  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant") as
    | (typeof messages)[number] & StreamingAssistantMessage
    | undefined;
  const activeTool = lastAssistantMessage?.toolInvocations?.find(
    (tool) => tool.state === "call" || tool.state === "partial-call",
  );
  const loadingLabel = activeTool
    ? TOOL_STATUS_LABELS[activeTool.toolName] ?? "Working..."
    : "Generating...";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-[520px] xl:max-w-[560px]"
      >
        <SheetHeader className="border-b border-border/70 bg-card px-6 py-5 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-amber-500" />
            AI Assistant
          </SheetTitle>
          <SheetDescription>
            Ask Konstruq to create one KPI or chart widget at a time for{" "}
            <span className="text-foreground">{dashboard.name}</span>.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col bg-background">
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <ChatThread
              messages={visibleMessages}
              isLoading={isLoading}
              error={error ?? undefined}
              onRetry={() => void reload()}
              suggestions={DASHBOARD_ASSISTANT_SUGGESTIONS}
              loadingLabel={loadingLabel}
              onSuggestionClick={(suggestion) =>
                void append({ role: "user", content: suggestion })
              }
              onAddWidget={onAddWidget}
              getAddWidgetState={getAddWidgetState}
            />
          </div>
          <ChatComposer
            input={input}
            isLoading={isLoading}
            isReady={true}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EmptyDashboardState({
  onOpenAssistant,
}: {
  onOpenAssistant: () => void;
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
          <LayoutDashboard className="h-6 w-6" />
        </span>
        <div className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">
            Start building your dashboard using the AI assistant
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Ask for a KPI widget, a trend chart, or the best first widget to add
            based on this project&apos;s uploaded datasets.
          </p>
        </div>
        <Button
          type="button"
          onClick={onOpenAssistant}
          className="bg-amber-500 text-amber-950 hover:bg-amber-400"
        >
          <Bot className="h-4 w-4" />
          AI Assistant
        </Button>
      </CardContent>
    </Card>
  );
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  );
}

export function CustomDashboardCanvas({
  dashboard,
  projectId,
  projectName,
}: CustomDashboardCanvasProps) {
  const [widgets, setWidgets] = useState<CustomDashboardWidget[]>(dashboard.widgets);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [isRefreshingDashboard, setIsRefreshingDashboard] = useState(false);
  const [widgetError, setWidgetError] = useState("");
  const [deletingWidgetId, setDeletingWidgetId] = useState("");
  const [widgetAddStates, setWidgetAddStates] = useState<
    Record<string, MessageWidgetAddState>
  >({});
  const [widgetRefreshErrors, setWidgetRefreshErrors] = useState<
    Record<string, string>
  >({});
  const [refreshingWidgetIds, setRefreshingWidgetIds] = useState<
    Record<string, boolean>
  >({});
  const addWidgetTimeoutsRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const hasPendingWidgetAdd = useMemo(
    () => Object.values(widgetAddStates).some((state) => state === "loading"),
    [widgetAddStates],
  );
  const hasPendingWidgetMutation = deletingWidgetId.length > 0 || hasPendingWidgetAdd;

  useEffect(() => {
    const timeouts = addWidgetTimeoutsRef.current;

    return () => {
      Object.values(timeouts).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
    };
  }, []);

  function clearAddWidgetTimeout(blockKey: string) {
    const timeoutId = addWidgetTimeoutsRef.current[blockKey];

    if (!timeoutId) {
      return;
    }

    clearTimeout(timeoutId);
    delete addWidgetTimeoutsRef.current[blockKey];
  }

  function scheduleAddedState(blockKey: string) {
    clearAddWidgetTimeout(blockKey);
    addWidgetTimeoutsRef.current[blockKey] = setTimeout(() => {
      setWidgetAddStates((current) =>
        current[blockKey]
          ? { ...current, [blockKey]: "added" }
          : current,
      );
      delete addWidgetTimeoutsRef.current[blockKey];
    }, ADD_WIDGET_SUCCESS_DURATION_MS);
  }

  function getAddWidgetState(blockKey: string): MessageWidgetAddState {
    return widgetAddStates[blockKey] ?? "idle";
  }

  async function fetchDashboardDetail(): Promise<CustomDashboardDetail> {
    const response = await fetch(`/api/custom-dashboards/${dashboard.id}`, {
      method: "GET",
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | ApiErrorPayload
      | unknown;

    if (!response.ok) {
      throw new Error(
        isApiErrorPayload(payload)
          ? payload.error
          : "Failed to refresh dashboard widgets",
      );
    }

    const parsed = parseCustomDashboardDetail(payload);

    if (!parsed) {
      throw new Error("Failed to parse refreshed dashboard widgets");
    }

    return parsed;
  }

  async function handleAddWidget(widget: MessageWidgetAddRequest) {
    if (isRefreshingDashboard || getAddWidgetState(widget.blockKey) !== "idle") {
      return;
    }

    clearAddWidgetTimeout(widget.blockKey);
    setWidgetAddStates((current) => ({
      ...current,
      [widget.blockKey]: "loading",
    }));
    setWidgetError("");

    try {
      const requestBody = buildCreateWidgetRequest(widget);
      const response = await fetch(`/api/custom-dashboards/${dashboard.id}/widgets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      const payload = (await response.json().catch(() => null)) as
        | ApiErrorPayload
        | unknown;

      if (!response.ok) {
        throw new Error(
          isApiErrorPayload(payload) ? payload.error : "Failed to add widget",
        );
      }

      const createdWidget = parseCreatedWidget(payload, dashboard);

      if (createdWidget) {
        setWidgets((current) => upsertWidget(current, createdWidget));
        setWidgetRefreshErrors((current) => {
          const next = { ...current };
          delete next[createdWidget.id];
          return next;
        });
      } else {
        const refreshedDashboard = await fetchDashboardDetail();
        setWidgets(refreshedDashboard.widgets);
        setWidgetRefreshErrors({});
      }

      setWidgetAddStates((current) => ({
        ...current,
        [widget.blockKey]: "success",
      }));
      scheduleAddedState(widget.blockKey);
    } catch (error) {
      clearAddWidgetTimeout(widget.blockKey);
      setWidgetAddStates((current) => {
        const next = { ...current };
        delete next[widget.blockKey];
        return next;
      });
      setWidgetError(toErrorMessage(error));
    }
  }

  async function handleDeleteWidget(widgetId: string) {
    if (isRefreshingDashboard) {
      return;
    }

    setDeletingWidgetId(widgetId);
    setWidgetError("");

    try {
      const response = await fetch(
        `/api/custom-dashboards/${dashboard.id}/widgets/${widgetId}`,
        {
          method: "DELETE",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | ApiErrorPayload
        | { success?: boolean }
        | null;

      if (!response.ok) {
        throw new Error(
          isApiErrorPayload(payload)
            ? payload.error
            : "Failed to delete widget",
        );
      }

      setWidgets((current) => current.filter((widget) => widget.id !== widgetId));
      setWidgetRefreshErrors((current) => {
        const next = { ...current };
        delete next[widgetId];
        return next;
      });
    } catch (error) {
      setWidgetError(toErrorMessage(error));
    } finally {
      setDeletingWidgetId("");
    }
  }

  async function handleRefreshDashboard() {
    if (isRefreshingDashboard || widgets.length === 0 || hasPendingWidgetMutation) {
      return;
    }

    const nextRefreshingWidgetIds = Object.fromEntries(
      widgets.map((widget) => [widget.id, true]),
    );

    setIsRefreshingDashboard(true);
    setWidgetError("");
    setWidgetRefreshErrors({});
    setRefreshingWidgetIds(nextRefreshingWidgetIds);

    try {
      const response = await fetch(`/api/custom-dashboards/${dashboard.id}/refresh`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | ApiErrorPayload
        | WidgetRefreshFailurePayload[]
        | unknown;

      if (!response.ok) {
        throw new Error(
          isApiErrorPayload(payload)
            ? payload.error
            : "Failed to refresh dashboard widgets",
        );
      }

      const parsed = parseRefreshResponse(payload, dashboard);

      if (!parsed) {
        throw new Error("Failed to parse refreshed dashboard widgets");
      }

      setWidgets(parsed.widgets);
      setWidgetRefreshErrors(parsed.widgetErrors);
    } catch (error) {
      setWidgetError(toErrorMessage(error));
    } finally {
      setRefreshingWidgetIds({});
      setIsRefreshingDashboard(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="space-y-5 py-6">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Link
                href="/projects"
                className="transition-colors hover:text-foreground"
              >
                Projects
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link
                href={`/projects/${projectId}`}
                className="transition-colors hover:text-foreground"
              >
                {projectName}
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground">{dashboard.name}</span>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Custom Dashboard
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {dashboard.name}
                </h1>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  {dashboard.description?.trim() ||
                    "A saved canvas of KPI and chart widgets for this project."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="outline">
                  <Link href={`/projects/${projectId}`}>Back to Project</Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleRefreshDashboard()}
                  disabled={
                    isRefreshingDashboard ||
                    widgets.length === 0 ||
                    hasPendingWidgetMutation
                  }
                >
                  {isRefreshingDashboard ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh
                </Button>
                <Button
                  type="button"
                  onClick={() => setAssistantOpen(true)}
                  disabled={isRefreshingDashboard}
                  className="bg-amber-500 text-amber-950 hover:bg-amber-400"
                >
                  <Bot className="h-4 w-4" />
                  AI Assistant
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {widgetError ? (
          <Card className="border-destructive/30 bg-card">
            <CardContent className="py-4 text-sm text-destructive">
              {widgetError}
            </CardContent>
          </Card>
        ) : null}

        {widgets.length === 0 ? (
          <EmptyDashboardState onOpenAssistant={() => setAssistantOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {widgets.map((widget) => {
              const deleting = deletingWidgetId === widget.id;
              const refreshing = refreshingWidgetIds[widget.id] ?? false;
              const refreshError = widgetRefreshErrors[widget.id];

              if (widget.widgetType === "kpi") {
                return (
                  <CustomDashboardKpiCard
                    key={widget.id}
                    widget={widget}
                    deleting={deleting || isRefreshingDashboard}
                    refreshError={refreshError}
                    refreshing={refreshing}
                    onDelete={() => void handleDeleteWidget(widget.id)}
                  />
                );
              }

              return (
                <CustomDashboardChartCard
                  key={widget.id}
                  widget={widget}
                  deleting={deleting || isRefreshingDashboard}
                  refreshError={refreshError}
                  refreshing={refreshing}
                  onDelete={() => void handleDeleteWidget(widget.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      <AssistantSheet
        dashboard={{ ...dashboard, widgets }}
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        onAddWidget={handleAddWidget}
        getAddWidgetState={getAddWidgetState}
      />
    </>
  );
}
