import { mistral } from "@ai-sdk/mistral";
import { generateText } from "ai";
import { and, desc, eq } from "drizzle-orm";

import {
  buildDatasetsContext,
  MAX_DATA_TOKENS,
  normalizeSheets,
  type DatasetContextItem,
} from "@/lib/ai/dataset-context";
import { db } from "@/lib/db";
import { projects, uploadedDatasets } from "@/lib/db/schema";

const PREVIEW_ROW_LIMIT = 30;

export type DashboardVariant = "executive" | "project-controls" | "financials";

export class DashboardGenerationError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DashboardGenerationError";
    this.status = status;
  }
}

const EXECUTIVE_DASHBOARD_SYSTEM_PROMPT = [
  "You are a data analytics assistant. Analyze the uploaded datasets and generate a business dashboard.",
  "Return ONLY valid JSON with no markdown code fences and no explanation outside the JSON.",
  "",
  "Output schema:",
  "{",
  '  "kpis": [',
  '    { "label": string, "value": number|string, "format": "currency"|"percentage"|"number"|"text", "description": string }',
  "  ],",
  '  "charts": [',
  "    {",
  '      "id": string,',
  '      "type": "bar"|"line"|"area"|"pie"|"scatter",',
  '      "title": string,',
  '      "group"?: string,',
  '      "data": [...],',
  '      "xKey"?: string,',
  '      "yKeys"?: string[],',
  '      "nameKey"?: string,',
  '      "valueKey"?: string,',
  '      "colors": string[]',
  "    }",
  "  ]",
  "}",
  "",
  "Rules:",
  "- Generate 3-5 KPI cards with key metrics such as totals, averages, counts, margins, completion, utilization, or variance.",
  "- Generate 4-8 charts that provide meaningful business insights.",
  "- Each chart should have 5-25 data points. Aggregate if the raw data has more rows.",
  '- For monetary values use format "currency"; percentages use "percentage".',
  "Data-aware chart priority rules (generate charts in this priority order based on detected data columns):",
  "- Cost/budget data (budget, actual, cost, committed, forecast): Budget vs Actual comparison, Cost Variance Trend, Top Variance Cost Codes",
  "- Schedule data (schedule, planned, actual, % complete, baseline, SV): Schedule Variance, SPI Trend, Task Completion % by project",
  "- EVM data (PV, EV, AC, CPI, SPI, earned value): EVM S-Curve, CPI/SPI Trend lines",
  "- Labor/resource data (labor, hours, crew, productivity, resource): Resource Utilisation chart, Productivity Trend",
  "- Subcontractor data (subcontractor, contractor, delivery, quality): On-Time Delivery %, Quality Scorecard",
  "- Cash flow data (AR, AP, invoice, payment, receivable, payable): Cashflow Forecast vs Actual, Outstanding Aging",
  "- Change order data (change order, variation, amendment): Change Order Impact Waterfall",
  "",
  "Chart grouping:",
  '- Assign each chart a "group" field based on its content domain. Use these group names:',
  '  "Risk & Performance" | "Schedule" | "Resources" | "Financial" | "Subcontractors" | "General"',
  "- KPIs do not need groups.",
  '- Color palette: ["#4f46e5","#06b6d4","#10b981","#f59e0b","#ef4444","#8b5cf6"]',
  "- Choose chart types by data nature: bar=comparisons, line/area=trends, pie=distributions, scatter=correlations.",
  "- Use only columns and values that actually exist in the provided datasets.",
  "- Ensure every chart includes the keys required by its type.",
  "- For scatter charts, use a numeric xKey and exactly one yKeys entry.",
  "- The data array for each chart must be plain JSON objects only.",
].join("\n");

const VARIANT_PROMPT_INTROS: Record<DashboardVariant, string[]> = {
  executive: [
    "Create an executive dashboard from these uploaded datasets.",
    "Prefer the most business-relevant metrics and aggregations you can infer from the available columns.",
    "If multiple datasets overlap, combine them only when the relationship is clear from the data.",
    "Do not invent columns, labels, or calculations that are not supported by the provided data.",
  ],
  "project-controls": [
    "Create a project controls dashboard from these uploaded datasets.",
    "Prioritize schedule tracking, delays, dependencies, task completion, and equipment utilisation metrics.",
    "Do not invent columns, labels, or calculations that are not supported by the provided data.",
  ],
  financials: [
    "Create a financial controls dashboard from these uploaded datasets.",
    "Prioritize budget control, earned value performance, cash flow, claims, and cost breakdown metrics.",
    "Do not invent columns, labels, or calculations that are not supported by the provided data.",
  ],
};

export const DASHBOARD_PROMPTS: Record<DashboardVariant, string> = {
  executive: EXECUTIVE_DASHBOARD_SYSTEM_PROMPT,
  "project-controls": [
    "You are a construction project controls analytics assistant. Analyze the uploaded datasets and generate a project controls dashboard focused on schedule, task performance, and operational metrics.",
    "Return ONLY valid JSON with no markdown code fences and no explanation outside the JSON.",
    "",
    "Output schema:",
    "{",
    '  "kpis": [',
    '    { "label": string, "value": number|string, "format": "currency"|"percentage"|"number"|"text", "description": string }',
    "  ],",
    '  "charts": [',
    "    {",
    '      "id": string,',
    '      "type": "bar"|"line"|"area"|"pie"|"scatter",',
    '      "title": string,',
    '      "group"?: string,',
    '      "data": [...],',
    '      "xKey"?: string,',
    '      "yKeys"?: string[],',
    '      "nameKey"?: string,',
    '      "valueKey"?: string,',
    '      "colors": string[]',
    "    }",
    "  ]",
    "}",
    "",
    "Rules:",
    "- Generate 3-5 KPI cards focused on schedule performance, task completion, delays, and resource metrics.",
    "- Generate 4-8 charts providing project controls insights.",
    "- Each chart should have 5-25 data points. Aggregate if the raw data has more rows.",
    '- For monetary values use format "currency"; percentages use "percentage".',
    '- Color palette: ["#4f46e5","#06b6d4","#10b981","#f59e0b","#ef4444","#8b5cf6"]',
    "- Choose chart types by data nature: bar=comparisons, line/area=trends, pie=distributions, scatter=correlations.",
    "- Use only columns and values that actually exist in the provided datasets.",
    "",
    "Data-aware chart priorities for project controls:",
    "- Schedule data: Baseline vs Actual progress, Schedule Variance (SV), SPI Trend, Critical Path Delay analysis",
    "- Task data: Task Completion % by category, Overdue Tasks Trend, Task Readiness Score",
    "- Dependency data: Dependency blocking analysis, Delay Cause Categories",
    "- Equipment data: Equipment Utilisation %, Downtime analysis, Cost per utilised hour",
    "- Resource data: Crew allocation, Workload distribution, Idle time analysis",
    "",
    "Chart grouping - use these groups:",
    '"Schedule Tracking" | "Task Performance" | "Dependencies & Delays" | "Equipment & Resources" | "General"',
    "- Ensure every chart includes the keys required by its type.",
    "- For scatter charts, use a numeric xKey and exactly one yKeys entry.",
    "- The data array for each chart must be plain JSON objects only.",
  ].join("\n"),
  financials: [
    "You are a construction financial analytics assistant. Analyze the uploaded datasets and generate a financial controls dashboard focused on cost performance, cash flows, earned value, and budget analytics.",
    "Return ONLY valid JSON with no markdown code fences and no explanation outside the JSON.",
    "",
    "Output schema:",
    "{",
    '  "kpis": [',
    '    { "label": string, "value": number|string, "format": "currency"|"percentage"|"number"|"text", "description": string }',
    "  ],",
    '  "charts": [',
    "    {",
    '      "id": string,',
    '      "type": "bar"|"line"|"area"|"pie"|"scatter",',
    '      "title": string,',
    '      "group"?: string,',
    '      "data": [...],',
    '      "xKey"?: string,',
    '      "yKeys"?: string[],',
    '      "nameKey"?: string,',
    '      "valueKey"?: string,',
    '      "colors": string[]',
    "    }",
    "  ]",
    "}",
    "",
    "Rules:",
    "- Generate 3-5 KPI cards focused on financial health: total budget, actual spend, variance, CPI, cash position.",
    "- Generate 4-8 charts providing financial analytics insights.",
    "- Each chart should have 5-25 data points. Aggregate if the raw data has more rows.",
    '- For monetary values use format "currency"; percentages use "percentage".',
    '- Color palette: ["#4f46e5","#06b6d4","#10b981","#f59e0b","#ef4444","#8b5cf6"]',
    "- Choose chart types by data nature: bar=comparisons, line/area=trends, pie=distributions, scatter=correlations.",
    "- Use only columns and values that actually exist in the provided datasets.",
    "",
    "Data-aware chart priorities for financial analytics:",
    "- Budget data: Budget vs Actual vs Forecast (stacked/grouped bar), Cost Variance Trend (line), Top Variance Cost Codes (bar), Committed vs Spent % (pie)",
    "- EVM data: EVM S-Curve with PV/EV/AC (line), CPI/SPI Trend (line), EAC Forecast comparison (bar), To Complete Performance Index",
    "- Cash flow data: Cashflow Forecast vs Actual (area), Outstanding Payments Aging (bar), Claims Certified vs Paid (grouped bar), Retention vs Release Trends (line)",
    "- Cost detail data: Cost Breakdown by Cost Code (pie/bar), Budget Utilisation by Phase (bar), Change Order Impact (bar), Unit Cost Trends (line)",
    "",
    "Chart grouping - use these groups:",
    '"Budget Control" | "Earned Value" | "Cash Flow & Claims" | "Cost Detail" | "General"',
  ].join("\n"),
};

export async function fetchUserDatasets(
  appUserId: string,
  projectId?: string,
): Promise<DatasetContextItem[]> {
  if (projectId) {
    const ownedProject = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, appUserId)))
      .limit(1);

    if (ownedProject.length === 0) {
      throw new DashboardGenerationError("Project not found", 404);
    }
  }

  const conditions = [
    eq(uploadedDatasets.userId, appUserId),
    eq(uploadedDatasets.isActive, true),
  ];

  if (projectId) {
    conditions.push(eq(uploadedDatasets.projectId, projectId));
  }

  const datasets = await db
    .select({
      id: uploadedDatasets.id,
      category: uploadedDatasets.category,
      fileName: uploadedDatasets.fileName,
      sheets: uploadedDatasets.sheets,
    })
    .from(uploadedDatasets)
    .where(and(...conditions))
    .orderBy(desc(uploadedDatasets.uploadedAt));

  return datasets.map((dataset) => ({
    id: dataset.id,
    category: dataset.category,
    fileName: dataset.fileName,
    sheets: normalizeSheets(dataset.sheets),
  }));
}

export function buildDashboardUserPrompt(
  datasets: DatasetContextItem[],
  variant: DashboardVariant,
): string {
  return [
    ...VARIANT_PROMPT_INTROS[variant],
    buildDatasetsContext(datasets, {
      previewRowLimit: PREVIEW_ROW_LIMIT,
      maxDataTokens: MAX_DATA_TOKENS,
    }),
  ].join("\n\n");
}

export async function callDashboardLLM(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const result = await generateText({
    model: mistral("mistral-large-latest"),
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.2,
    maxSteps: 1,
  });

  return result.text;
}

export function parseJsonResponse(text: string): unknown {
  const trimmed = text.trim();
  const candidates = [trimmed];

  if (trimmed.startsWith("```")) {
    candidates.push(
      trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim(),
    );
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    if (candidate.length === 0) {
      continue;
    }

    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      continue;
    }
  }

  throw new Error("AI response was not valid JSON");
}
