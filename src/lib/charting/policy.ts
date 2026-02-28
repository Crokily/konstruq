export type AnalyticsDomain = "construction" | "finance" | "healthcare" | "retail" | "general";

export type ChartIntent =
  | "composition"
  | "trend"
  | "ranking"
  | "distribution"
  | "relationship"
  | "deviation"
  | "forecast";

export type DataShape = "time-series" | "categorical" | "numeric" | "mixed";
export type RecommendedChartType =
  | "bar"
  | "line"
  | "area"
  | "pie"
  | "scatter"
  | "stacked-bar"
  | "composed";

export interface DatasetSummarySheet {
  sheetName: string;
  columns: string[];
  rowCount: number;
}

export interface DatasetSummary {
  category?: string;
  fileName?: string;
  sheets: DatasetSummarySheet[];
}

interface DomainSignal {
  domain: AnalyticsDomain;
  score: number;
  signal: string;
}

export interface ChartRecommendationInput {
  domain: AnalyticsDomain;
  intent: ChartIntent;
  dataShape: DataShape;
  categoryCount?: number;
  metricCount?: number;
}

export interface ChartRecommendation {
  chartType: RecommendedChartType;
  rationale: string;
  fallback: string;
}

const DOMAIN_KEYWORDS: Record<Exclude<AnalyticsDomain, "general">, string[]> = {
  construction: [
    "construction",
    "project",
    "cost code",
    "evm",
    "earned value",
    "change order",
    "schedule",
    "rfi",
    "subcontractor",
    "progress claim",
    "billings",
  ],
  finance: [
    "finance",
    "financial",
    "cash flow",
    "revenue",
    "expense",
    "margin",
    "ar",
    "ap",
    "invoice",
    "ledger",
    "budget",
  ],
  healthcare: [
    "healthcare",
    "patient",
    "encounter",
    "clinic",
    "hospital",
    "diagnosis",
    "length of stay",
    "readmission",
    "claim",
    "provider",
  ],
  retail: [
    "retail",
    "store",
    "sku",
    "basket",
    "inventory",
    "sell-through",
    "footfall",
    "promotion",
    "category",
    "order",
    "conversion",
  ],
};

const BASE_POLICY = {
  composition: "Pie/donut only when <= 6 categories and labels are short. Otherwise use sorted bar or stacked bar.",
  trend: "Use line for clear trends, area for magnitude + trend, and stacked area only when additive total matters.",
  ranking: "Use sorted bar/column. Horizontal bar for long category labels.",
  distribution: "Use histogram for frequency distributions and boxplot for spread/outlier-focused analysis.",
  relationship: "Use scatter for 2 numeric axes, bubble when a third size metric is meaningful.",
  deviation: "Use variance bar or waterfall for movement from baseline to outcome.",
  forecast: "Use line/area with confidence bands for forecasts; always separate actual vs projected periods.",
} as const;

const DOMAIN_OVERRIDES: Record<AnalyticsDomain, Partial<Record<ChartIntent, string>>> = {
  construction: {
    composition:
      "Prefer stacked bar for cost code/project package breakdown; donut is secondary and only for very small category counts.",
    trend:
      "Prefer S-curve style line/composed charts for PV/EV/AC and CPI/SPI over time.",
    deviation:
      "Prefer waterfall for change orders, contingency movements, and budget revisions.",
    forecast:
      "Show expected completion date and EAC trend with confidence bounds where possible.",
  },
  finance: {
    composition:
      "Prefer stacked bar/stacked area for portfolio allocation; avoid pie beyond 5 slices.",
    trend:
      "Prefer line/area for rolling revenue, margin, and burn trends.",
    deviation:
      "Prefer waterfall for bridge analyses (budget to actual, plan to forecast).",
    forecast:
      "Use forecast line + confidence band for revenue/expense/cash runway projections.",
  },
  healthcare: {
    composition:
      "Use stacked bar for cohort/service-line mix and patient-type share comparisons.",
    trend:
      "Use line for quality/safety outcomes over time; compare baseline vs current period.",
    distribution:
      "Use histogram/boxplot for wait time and length-of-stay spread.",
    relationship:
      "Use scatter to explore outcome vs utilization/cost relationships.",
  },
  retail: {
    composition:
      "Use stacked bar for category/channel contribution and sell-through mix.",
    trend:
      "Use line/area for seasonality and conversion trend analysis.",
    ranking:
      "Use sorted bar for top/bottom products, stores, or categories.",
    relationship:
      "Use scatter/bubble for price-discount-volume or promo-response analysis.",
  },
  general: {},
};

function normalizeText(value: string | undefined): string {
  return (value ?? "").toLowerCase();
}

const INTENT_KEYWORDS: Array<{ intent: ChartIntent; keywords: string[] }> = [
  { intent: "forecast", keywords: ["forecast", "projection", "predict", "expected", "confidence"] },
  { intent: "trend", keywords: ["trend", "over time", "monthly", "weekly", "timeline", "time series"] },
  {
    intent: "composition",
    keywords: ["breakdown", "allocation", "composition", "share", "mix", "portion", "percentage", "percent", "%"],
  },
  { intent: "ranking", keywords: ["top", "bottom", "rank", "compare", "highest", "lowest"] },
  { intent: "distribution", keywords: ["distribution", "spread", "variance", "outlier", "percentile"] },
  { intent: "relationship", keywords: ["correlation", "relationship", "impact", "vs", "between"] },
  { intent: "deviation", keywords: ["variance", "delta", "difference", "bridge", "change order", "overrun"] },
];

const TIME_HINTS = ["date", "month", "week", "year", "period", "quarter", "time"];
const NUMERIC_HINTS = ["amount", "cost", "value", "price", "qty", "quantity", "hours", "score", "rate", "index"];

function collectCorpus(dataset: DatasetSummary): string {
  const parts = [dataset.category ?? "", dataset.fileName ?? ""];

  for (const sheet of dataset.sheets) {
    parts.push(sheet.sheetName);
    parts.push(sheet.columns.join(" "));
  }

  return normalizeText(parts.join(" "));
}

function inferDataShapeFromDatasets(datasets: DatasetSummary[]): DataShape {
  const columns = datasets.flatMap((dataset) => dataset.sheets.flatMap((sheet) => sheet.columns.map(normalizeText)));

  if (columns.length === 0) {
    return "mixed";
  }

  const hasTime = columns.some((column) => TIME_HINTS.some((hint) => column.includes(hint)));
  const hasNumericHints = columns.some((column) => NUMERIC_HINTS.some((hint) => column.includes(hint)));

  if (hasTime && hasNumericHints) {
    return "time-series";
  }

  if (hasNumericHints) {
    return "numeric";
  }

  return "categorical";
}

export function inferIntentFromQuestion(question: string | undefined): ChartIntent {
  const normalized = normalizeText(question);

  if (!normalized) {
    return "ranking";
  }

  for (const item of INTENT_KEYWORDS) {
    if (item.keywords.some((keyword) => normalized.includes(keyword))) {
      return item.intent;
    }
  }

  return "ranking";
}

export function recommendChartType(input: ChartRecommendationInput): ChartRecommendation {
  const metricCount = Math.max(1, input.metricCount ?? 1);
  const categoryCount = Math.max(0, input.categoryCount ?? 0);

  if (input.intent === "forecast") {
    return {
      chartType: metricCount > 1 ? "composed" : "area",
      rationale: "Forecasts are best read as a time progression with optional confidence band and actual-vs-projected separation.",
      fallback: "If confidence band data is unavailable, use a line chart and label projected segment explicitly.",
    };
  }

  if (input.intent === "trend") {
    if (input.domain === "construction" && metricCount >= 3) {
      return {
        chartType: "composed",
        rationale: "Construction trend analysis commonly compares PV/EV/AC together, which fits a composed trend view.",
        fallback: "If mixed-scale series reduce readability, split into two line charts by metric family.",
      };
    }

    return {
      chartType: input.dataShape === "time-series" ? "line" : "area",
      rationale: "Trend questions are best served by continuous lines over ordered periods.",
      fallback: "If x-axis is not time ordered, switch to sorted bar for period comparisons.",
    };
  }

  if (input.intent === "composition") {
    if (categoryCount > 0 && categoryCount <= 6) {
      return {
        chartType: "pie",
        rationale: "Small-part composition is immediately readable as a pie/donut view.",
        fallback: "When categories exceed six or labels are long, switch to sorted bar or stacked bar.",
      };
    }

    return {
      chartType: input.domain === "construction" || metricCount > 1 ? "stacked-bar" : "bar",
      rationale: "Composition with many categories is more legible in stacked/sorted bars than in pie slices.",
      fallback: "If stack segments are too dense, split into grouped bars by category.",
    };
  }

  if (input.intent === "distribution") {
    return {
      chartType: "bar",
      rationale: "Distribution views need binned or grouped frequencies and are clearer than pie for spread analysis.",
      fallback: "If raw values are too granular, bin into ranges before plotting.",
    };
  }

  if (input.intent === "relationship") {
    return {
      chartType: "scatter",
      rationale: "Relationship analysis requires two numeric axes to expose correlation and outliers.",
      fallback: "If only one numeric variable exists, switch to bar/line against category or time.",
    };
  }

  if (input.intent === "deviation") {
    return {
      chartType: input.domain === "construction" || input.domain === "finance" ? "composed" : "bar",
      rationale: "Deviation analysis benefits from baseline vs delta comparison with clear positive/negative movement.",
      fallback: "If delta decomposition is unavailable, use variance bars sorted by absolute impact.",
    };
  }

  return {
    chartType: "bar",
    rationale: "Ranking and category comparison is most readable as a sorted bar chart.",
    fallback: "If labels are too long or many categories exist, keep horizontal orientation and group tail values into Other.",
  };
}

function detectDomainSignals(datasets: DatasetSummary[]): DomainSignal[] {
  const corpus = normalizeText(datasets.map(collectCorpus).join(" "));

  const signals: DomainSignal[] = [];

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as Array<
    [Exclude<AnalyticsDomain, "general">, string[]]
  >) {
    for (const keyword of keywords) {
      if (corpus.includes(keyword)) {
        signals.push({
          domain,
          score: keyword.includes(" ") ? 2 : 1,
          signal: keyword,
        });
      }
    }
  }

  return signals;
}

export function inferAnalyticsDomain(datasets: DatasetSummary[]): {
  domain: AnalyticsDomain;
  confidence: number;
  matchedSignals: string[];
} {
  if (datasets.length === 0) {
    return { domain: "general", confidence: 0, matchedSignals: [] };
  }

  const signals = detectDomainSignals(datasets);

  if (signals.length === 0) {
    return { domain: "general", confidence: 0.2, matchedSignals: [] };
  }

  const byDomain = new Map<AnalyticsDomain, { score: number; signalSet: Set<string> }>();

  for (const signal of signals) {
    const existing = byDomain.get(signal.domain) ?? { score: 0, signalSet: new Set<string>() };
    existing.score += signal.score;
    existing.signalSet.add(signal.signal);
    byDomain.set(signal.domain, existing);
  }

  const ranked = [...byDomain.entries()].sort((a, b) => b[1].score - a[1].score);
  const [topDomain, topMeta] = ranked[0] ?? ["general" as AnalyticsDomain, { score: 0, signalSet: new Set<string>() }];
  const totalScore = ranked.reduce((sum, [, meta]) => sum + meta.score, 0);
  const confidence = totalScore > 0 ? Math.min(0.98, topMeta.score / totalScore) : 0.2;

  return {
    domain: topDomain,
    confidence,
    matchedSignals: [...topMeta.signalSet],
  };
}

function renderPolicyRows(domain: AnalyticsDomain): string {
  const overrides = DOMAIN_OVERRIDES[domain] ?? {};
  const intents = Object.keys(BASE_POLICY) as ChartIntent[];

  return intents
    .map((intent) => {
      const preferred = overrides[intent] ?? BASE_POLICY[intent];
      return `- ${intent}: ${preferred}`;
    })
    .join("\n");
}

export function buildChartSelectionPolicyPrompt(
  datasets: DatasetSummary[],
  question?: string,
): string {
  const domainInference = inferAnalyticsDomain(datasets);
  const inferredDomain = domainInference.domain;
  const inferredIntent = inferIntentFromQuestion(question);
  const inferredShape = inferDataShapeFromDatasets(datasets);
  const recommendation = recommendChartType({
    domain: inferredDomain,
    intent: inferredIntent,
    dataShape: inferredShape,
  });

  const policyHeader = [
    "Chart selection policy (must follow):",
    `- Inferred dataset domain: ${inferredDomain} (confidence ${(domainInference.confidence * 100).toFixed(0)}%)`,
    domainInference.matchedSignals.length > 0
      ? `- Domain signals found: ${domainInference.matchedSignals.join(", ")}`
      : "- Domain signals found: none (fallback to general analytics policy)",
    "- Determine question intent first, then match chart type using the intent rules below.",
    "- Evaluate data shape before charting: time-series, categorical, numeric, or mixed.",
    "- Always include a selection explanation and fallback logic in the chart JSON.",
  ].join("\n");

  const fallbackRules = [
    "Readability fallback rules (mandatory):",
    "- If pie/donut has > 6 categories, switch to sorted bar chart.",
    "- If category labels are long or > 12 categories, use horizontal bar (or bar with rotated ticks).",
    "- If scatter cannot map two numeric axes, switch to bar/line and explain why.",
    "- If forecast is requested and uncertainty exists, include confidence band using area/composed chart.",
    "- If multiple metrics have different scales, use composed chart or secondary axis logic.",
  ].join("\n");

  const outputContract = [
    "Chart JSON contract extension:",
    '- Add optional `subtitle` to clarify scope and period.',
    "- Add `selection` object with:",
    '  - `domain`: "construction|finance|healthcare|retail|general"',
    '  - `intent`: "composition|trend|ranking|distribution|relationship|deviation|forecast"',
    "  - `rationale`: one short sentence why this chart best fits the question + data shape",
    "  - `fallback`: one short sentence explaining what chart to use if readability constraints are violated",
  ].join("\n");

  const recommendationSection = [
    "Current question recommendation:",
    `- Inferred intent: ${inferredIntent}`,
    `- Inferred data shape: ${inferredShape}`,
    `- Recommended chart type: ${recommendation.chartType}`,
    `- Rationale: ${recommendation.rationale}`,
    `- Fallback: ${recommendation.fallback}`,
  ].join("\n");

  return [
    policyHeader,
    "Intent-to-chart preferences:",
    renderPolicyRows(inferredDomain),
    fallbackRules,
    recommendationSection,
    outputContract,
  ].join("\n\n");
}
