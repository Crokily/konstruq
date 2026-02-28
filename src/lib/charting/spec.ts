import {
  inferIntentFromQuestion,
  recommendChartType,
  type AnalyticsDomain,
  type ChartIntent,
  type DataShape,
} from "@/lib/charting/policy";

export type SupportedChartType =
  | "bar"
  | "line"
  | "area"
  | "pie"
  | "scatter"
  | "stacked-bar"
  | "composed";

export interface ChartSpecMetric {
  key: string;
  label: string;
  color?: string;
}

export interface ChartSourceReference {
  fileName: string;
  sheetName: string;
  columns: string[];
}

export interface ChartSelectionMetadata {
  domain?: AnalyticsDomain;
  intent?: ChartIntent;
  rationale?: string;
  fallback?: string;
}

export interface ChartSpec {
  type: SupportedChartType;
  title: string;
  subtitle?: string;
  xAxisKey: string;
  metrics: ChartSpecMetric[];
  data: Array<Record<string, unknown>>;
  sources?: ChartSourceReference[];
  selection?: ChartSelectionMetadata;
}

export interface ChartRenderHints {
  xAxisAngle: number;
  xAxisHeight: number;
  showLegend: boolean;
  height: number;
}

export interface NormalizeChartSpecResult {
  spec: ChartSpec;
  warnings: string[];
  hints: ChartRenderHints;
}

export const CHART_STYLE_SPEC = {
  palette: ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"],
  gridStroke: "var(--border)",
  gridOpacity: 0.55,
  gridDash: "4 4",
  chartMargin: { top: 8, right: 14, left: 8, bottom: 20 },
} as const;

const SUPPORTED_CHART_TYPES: Set<SupportedChartType> = new Set([
  "bar",
  "line",
  "area",
  "pie",
  "scatter",
  "stacked-bar",
  "composed",
]);

const PIE_MAX_CATEGORIES = 6;
const CATEGORY_LIMIT = 12;
const TYPE_EQUIVALENCE: Record<ChartIntent, SupportedChartType[]> = {
  composition: ["pie", "stacked-bar", "bar"],
  trend: ["line", "area", "composed"],
  ranking: ["bar", "stacked-bar"],
  distribution: ["bar"],
  relationship: ["scatter"],
  deviation: ["bar", "composed"],
  forecast: ["line", "area", "composed"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function resolveType(type: unknown): SupportedChartType {
  if (typeof type === "string" && SUPPORTED_CHART_TYPES.has(type as SupportedChartType)) {
    return type as SupportedChartType;
  }

  return "bar";
}

function normalizeMetrics(raw: unknown): ChartSpecMetric[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((metric): ChartSpecMetric | null => {
      if (!isRecord(metric) || typeof metric.key !== "string" || metric.key.trim().length === 0) {
        return null;
      }

      return {
        key: metric.key,
        label:
          typeof metric.label === "string" && metric.label.trim().length > 0
            ? metric.label
            : metric.key,
        color: typeof metric.color === "string" ? metric.color : undefined,
      };
    })
    .filter((metric): metric is ChartSpecMetric => metric !== null);
}

function normalizeData(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((row): row is Record<string, unknown> => isRecord(row));
}

function normalizeSelection(raw: unknown): ChartSelectionMetadata | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const domain = typeof raw.domain === "string" ? raw.domain : undefined;
  const intent = typeof raw.intent === "string" ? raw.intent : undefined;

  return {
    domain: domain as AnalyticsDomain | undefined,
    intent: intent as ChartIntent | undefined,
    rationale: typeof raw.rationale === "string" ? raw.rationale : undefined,
    fallback: typeof raw.fallback === "string" ? raw.fallback : undefined,
  };
}

function normalizeSources(raw: unknown): ChartSourceReference[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item): ChartSourceReference | null => {
      if (!isRecord(item)) {
        return null;
      }

      const columns = Array.isArray(item.columns)
        ? item.columns.filter((column): column is string => typeof column === "string" && column.trim().length > 0)
        : [];

      if (
        typeof item.fileName !== "string" ||
        item.fileName.trim().length === 0 ||
        typeof item.sheetName !== "string" ||
        item.sheetName.trim().length === 0 ||
        columns.length === 0
      ) {
        return null;
      }

      return {
        fileName: item.fileName,
        sheetName: item.sheetName,
        columns,
      };
    })
    .filter((item): item is ChartSourceReference => item !== null);
}

function withDefaultColors(spec: ChartSpec): ChartSpec {
  return {
    ...spec,
    metrics: spec.metrics.map((metric, index) => ({
      ...metric,
      color: metric.color ?? CHART_STYLE_SPEC.palette[index % CHART_STYLE_SPEC.palette.length],
    })),
  };
}

function inferSpecDataShape(spec: ChartSpec): DataShape {
  const first = spec.data[0];

  if (!first) {
    return "mixed";
  }

  const xValue = first[spec.xAxisKey];
  const hasNumericMetric = spec.metrics.some((metric) => asFiniteNumber(first[metric.key]) !== null);

  if (hasNumericMetric && typeof xValue === "string") {
    const maybeDate = Date.parse(xValue);
    if (!Number.isNaN(maybeDate)) {
      return "time-series";
    }

    return "categorical";
  }

  if (hasNumericMetric && asFiniteNumber(xValue) !== null) {
    return "numeric";
  }

  return "mixed";
}

function enforceIntentRecommendation(spec: ChartSpec, warnings: string[]): ChartSpec {
  const inferredIntent =
    spec.selection?.intent ??
    inferIntentFromQuestion(`${spec.title} ${spec.subtitle ?? ""}`.trim());
  const inferredDomain = spec.selection?.domain ?? "construction";

  const recommendation = recommendChartType({
    domain: inferredDomain,
    intent: inferredIntent,
    dataShape: inferSpecDataShape(spec),
    categoryCount: spec.data.length,
    metricCount: spec.metrics.length,
  });

  if (TYPE_EQUIVALENCE[inferredIntent].includes(spec.type)) {
    return {
      ...spec,
      selection: {
        domain: inferredDomain,
        intent: inferredIntent,
        rationale: spec.selection?.rationale ?? recommendation.rationale,
        fallback: spec.selection?.fallback ?? recommendation.fallback,
      },
    };
  }

  warnings.push(
    `Chart type optimized: switched from ${spec.type} to ${recommendation.chartType} for ${inferredIntent} intent.`,
  );

  return {
    ...spec,
    type: recommendation.chartType,
    selection: {
      ...spec.selection,
      domain: inferredDomain,
      intent: inferredIntent,
      rationale: spec.selection?.rationale ?? recommendation.rationale,
      fallback: spec.selection?.fallback ?? recommendation.fallback,
    },
  };
}

function fallbackPieToBar(spec: ChartSpec, warnings: string[]): ChartSpec {
  if (spec.type !== "pie") {
    return spec;
  }

  if (spec.metrics.length === 0) {
    return spec;
  }

  if (spec.data.length <= PIE_MAX_CATEGORIES) {
    return spec;
  }

  const primaryMetric = spec.metrics[0].key;
  const sorted = [...spec.data].sort((a, b) => {
    const aValue = asFiniteNumber(a[primaryMetric]) ?? Number.NEGATIVE_INFINITY;
    const bValue = asFiniteNumber(b[primaryMetric]) ?? Number.NEGATIVE_INFINITY;
    return bValue - aValue;
  });

  warnings.push(
    `Pie readability fallback applied: ${spec.data.length} categories exceeds ${PIE_MAX_CATEGORIES}, switched to sorted bar chart.`,
  );

  return {
    ...spec,
    type: "bar",
    data: sorted,
  };
}

function compressLargeCategorySeries(spec: ChartSpec, warnings: string[]): ChartSpec {
  if (spec.type === "pie" || spec.type === "scatter") {
    return spec;
  }

  if (spec.data.length <= CATEGORY_LIMIT) {
    return spec;
  }

  if (spec.metrics.length === 0) {
    return spec;
  }

  const primaryMetric = spec.metrics[0].key;
  const sorted = [...spec.data].sort((a, b) => {
    const aValue = asFiniteNumber(a[primaryMetric]) ?? Number.NEGATIVE_INFINITY;
    const bValue = asFiniteNumber(b[primaryMetric]) ?? Number.NEGATIVE_INFINITY;
    return bValue - aValue;
  });

  const topRows = sorted.slice(0, CATEGORY_LIMIT - 1);
  const tailRows = sorted.slice(CATEGORY_LIMIT - 1);

  if (tailRows.length === 0) {
    return spec;
  }

  const other: Record<string, unknown> = {
    [spec.xAxisKey]: "Other",
  };

  for (const metric of spec.metrics) {
    const sum = tailRows.reduce((acc, row) => acc + (asFiniteNumber(row[metric.key]) ?? 0), 0);
    other[metric.key] = sum;
  }

  warnings.push(
    `Category compression applied: reduced ${spec.data.length} categories to top ${CATEGORY_LIMIT - 1} plus Other for readability.`,
  );

  return {
    ...spec,
    data: [...topRows, other],
  };
}

function fallbackInvalidScatter(spec: ChartSpec, warnings: string[]): ChartSpec {
  if (spec.type !== "scatter" || spec.metrics.length === 0) {
    return spec;
  }

  const metric = spec.metrics[0];
  const hasValidPoints = spec.data.some((row) => {
    const x = asFiniteNumber(row[spec.xAxisKey]);
    const y = asFiniteNumber(row[metric.key]);
    return x !== null && y !== null;
  });

  if (hasValidPoints) {
    return spec;
  }

  warnings.push("Scatter fallback applied: no numeric x/y pairs detected, switched to bar chart.");

  return {
    ...spec,
    type: "bar",
  };
}

function buildRenderHints(spec: ChartSpec): ChartRenderHints {
  interface LabelStats {
    count: number;
    longest: number;
  }

  const labelStats = spec.data.reduce(
    (acc: LabelStats, row): LabelStats => {
      const value = row[spec.xAxisKey];
      const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
      return {
        count: acc.count + 1,
        longest: Math.max(acc.longest, text.length),
      };
    },
    { count: 0, longest: 0 } as LabelStats,
  );

  const shouldRotate = labelStats.count > 10 || labelStats.longest > 14;

  return {
    xAxisAngle: 0,
    xAxisHeight: shouldRotate ? 110 : 56,
    showLegend: spec.metrics.length > 1 || spec.type === "pie" || spec.type === "scatter",
    height: spec.type === "pie" ? 320 : 300,
  };
}

function normalizeFieldKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isLooselyMatchedField(required: string, source: string): boolean {
  const left = normalizeFieldKey(required);
  const right = normalizeFieldKey(source);

  if (!left || !right) {
    return false;
  }

  return left === right || left.includes(right) || right.includes(left);
}

function hasSourceCoverage(spec: ChartSpec): boolean {
  const sources = spec.sources ?? [];

  if (sources.length === 0) {
    return false;
  }

  const sourceColumns = sources.flatMap((source) => source.columns);
  const requiredKeys = [spec.xAxisKey, ...spec.metrics.map((metric) => metric.key)].map((key) =>
    key.trim(),
  );

  const matchedCount = requiredKeys.filter((required) =>
    sourceColumns.some((sourceColumn) => isLooselyMatchedField(required, sourceColumn)),
  ).length;

  // Relaxed rule: treat source mapping as valid when most required fields match.
  return matchedCount >= Math.max(1, requiredKeys.length - 1);
}

export function normalizeChartSpec(raw: unknown): NormalizeChartSpecResult | null {
  if (!isRecord(raw)) {
    return null;
  }

  const baseSpec: ChartSpec = {
    type: resolveType(raw.type),
    title: typeof raw.title === "string" && raw.title.trim().length > 0 ? raw.title : "Chart",
    subtitle: typeof raw.subtitle === "string" && raw.subtitle.trim().length > 0 ? raw.subtitle : undefined,
    xAxisKey: typeof raw.xAxisKey === "string" && raw.xAxisKey.trim().length > 0 ? raw.xAxisKey : "name",
    metrics: normalizeMetrics(raw.metrics),
    data: normalizeData(raw.data),
    sources: normalizeSources(raw.sources),
    selection: normalizeSelection(raw.selection),
  };

  if (baseSpec.metrics.length === 0 || baseSpec.data.length === 0) {
    return null;
  }

  const warnings: string[] = [];
  if ((baseSpec.sources?.length ?? 0) === 0) {
    warnings.push("Source file references are not attached to this chart yet.");
  } else if (!hasSourceCoverage(baseSpec)) {
    warnings.push("Some source columns could not be matched exactly; showing chart with best-effort mapping.");
  }

  let spec = withDefaultColors(baseSpec);
  spec = enforceIntentRecommendation(spec, warnings);
  spec = fallbackPieToBar(spec, warnings);
  spec = fallbackInvalidScatter(spec, warnings);
  spec = compressLargeCategorySeries(spec, warnings);

  return {
    spec,
    warnings,
    hints: buildRenderHints(spec),
  };
}
