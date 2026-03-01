import type {
  MessageKpiItem,
  MessageWidgetAddRequest,
} from "@/components/chat/message-renderer";
import {
  CHART_STYLE_SPEC,
  type ChartSpec as AssistantChartSpec,
  type SupportedChartType,
} from "@/lib/charting/spec";
import type { ChartType, KPIItem } from "@/lib/dashboard/types";

export interface CreateDashboardWidgetRequest {
  widgetType: "chart" | "kpi";
  title: string;
  config: Record<string, unknown>;
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

export function buildDashboardChartConfig(
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

export function buildDashboardKpiConfig(
  item: MessageKpiItem,
): Record<string, unknown> {
  const format: KPIItem["format"] = "text";

  return {
    ...item,
    format,
  };
}

export function buildCreateDashboardWidgetRequest(
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
