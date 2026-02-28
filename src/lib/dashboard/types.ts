export const DASHBOARD_STORAGE_KEY = "konstruq-dashboard-v1";

export const DASHBOARD_COLOR_PALETTE = [
  "#4f46e5",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
] as const;

const KPI_FORMAT_VALUES = ["currency", "percentage", "number", "text"] as const;
const CHART_TYPE_VALUES = ["bar", "line", "area", "pie", "scatter"] as const;

export type KPIFormat = (typeof KPI_FORMAT_VALUES)[number];
export type ChartType = (typeof CHART_TYPE_VALUES)[number];

export interface KPIItem {
  label: string;
  value: string | number;
  format: KPIFormat;
  description?: string;
}

export interface ChartMethodology {
  formula?: string;
  description?: string;
  assumptions?: string[];
}

export interface ChartSpec {
  id: string;
  type: ChartType;
  title: string;
  group?: string;
  data: Record<string, unknown>[];
  xKey?: string;
  yKeys?: string[];
  nameKey?: string;
  valueKey?: string;
  colors: string[];
  methodology?: ChartMethodology;
}

export interface DashboardContent {
  kpis: KPIItem[];
  charts: ChartSpec[];
}

export interface DashboardResponse extends DashboardContent {
  datasetIds: string[];
}

export interface DashboardCache extends DashboardContent {
  cacheKey: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function normalizeColors(value: unknown, minLength = 1): string[] {
  const providedColors = parseStringArray(value).map((color) => color.trim());
  const colors = providedColors.filter((color) => color.length > 0);
  const targetLength = Math.max(1, minLength);

  if (colors.length >= targetLength) {
    return colors.slice(0, targetLength);
  }

  const fallbackColors = [...colors];

  while (fallbackColors.length < targetLength) {
    const nextColor =
      DASHBOARD_COLOR_PALETTE[
        fallbackColors.length % DASHBOARD_COLOR_PALETTE.length
      ];
    fallbackColors.push(nextColor);
  }

  return fallbackColors;
}

function parseKPIItem(value: unknown, index: number): KPIItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const label =
    typeof value.label === "string" && value.label.trim().length > 0
      ? value.label.trim()
      : `Metric ${index + 1}`;
  const format = KPI_FORMAT_VALUES.includes(value.format as KPIFormat)
    ? (value.format as KPIFormat)
    : "text";
  const rawValue = value.value;

  if (typeof rawValue !== "string" && typeof rawValue !== "number") {
    return null;
  }

  const description =
    typeof value.description === "string" && value.description.trim().length > 0
      ? value.description.trim()
      : undefined;

  return {
    label,
    value: typeof rawValue === "string" ? rawValue.trim() : rawValue,
    format,
    description,
  };
}

function parseMethodology(value: unknown): ChartMethodology | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    formula: typeof value.formula === "string" ? value.formula : undefined,
    description: typeof value.description === "string" ? value.description : undefined,
    assumptions: Array.isArray(value.assumptions)
      ? value.assumptions.filter(
          (assumption): assumption is string => typeof assumption === "string",
        )
      : undefined,
  };
}

function parseChartSpec(value: unknown, index: number): ChartSpec | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = CHART_TYPE_VALUES.includes(value.type as ChartType)
    ? (value.type as ChartType)
    : null;

  if (!type) {
    return null;
  }

  const id =
    typeof value.id === "string" && value.id.trim().length > 0
      ? value.id.trim()
      : `chart-${index + 1}`;
  const title =
    typeof value.title === "string" && value.title.trim().length > 0
      ? value.title.trim()
      : `Chart ${index + 1}`;
  const group =
    typeof value.group === "string" && value.group.trim().length > 0
      ? value.group.trim()
      : undefined;
  const data = Array.isArray(value.data)
    ? value.data.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];
  const methodology = parseMethodology(value.methodology);

  if (type === "pie") {
    if (typeof value.nameKey !== "string" || typeof value.valueKey !== "string") {
      return null;
    }

    return {
      id,
      type,
      title,
      group,
      data,
      nameKey: value.nameKey,
      valueKey: value.valueKey,
      colors: normalizeColors(value.colors, 1),
      methodology,
    };
  }

  if (typeof value.xKey !== "string") {
    return null;
  }

  const yKeys = parseStringArray(value.yKeys);

  if (yKeys.length === 0) {
    return null;
  }

  return {
    id,
    type,
    title,
    group,
    data,
    xKey: value.xKey,
    yKeys: type === "scatter" ? yKeys.slice(0, 1) : yKeys,
    colors: normalizeColors(
      value.colors,
      type === "scatter" ? 1 : yKeys.length,
    ),
    methodology,
  };
}

export function parseDashboardContent(value: unknown): DashboardContent | null {
  if (!isRecord(value)) {
    return null;
  }

  const kpis = Array.isArray(value.kpis)
    ? value.kpis
        .map((item, index) => parseKPIItem(item, index))
        .filter((item): item is KPIItem => item !== null)
        .slice(0, 5)
    : [];
  const charts = Array.isArray(value.charts)
    ? value.charts
        .map((item, index) => parseChartSpec(item, index))
        .filter((item): item is ChartSpec => item !== null)
        .slice(0, 8)
    : [];

  if (kpis.length === 0 && charts.length === 0) {
    return null;
  }

  return { kpis, charts };
}

export function parseDashboardResponse(value: unknown): DashboardResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const content = parseDashboardContent(value);
  const datasetIds = parseStringArray(value.datasetIds);

  if (!content || datasetIds.length === 0) {
    return null;
  }

  return {
    datasetIds,
    ...content,
  };
}

export function parseDashboardCache(value: string | null): DashboardCache | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!isRecord(parsed) || typeof parsed.cacheKey !== "string") {
      return null;
    }

    const content = parseDashboardContent(parsed);

    if (!content) {
      return null;
    }

    return {
      cacheKey: parsed.cacheKey,
      ...content,
    };
  } catch {
    return null;
  }
}

export function buildDashboardCacheKey(datasetIds: string[]): string {
  return [...datasetIds].sort((a, b) => a.localeCompare(b)).join(",");
}
