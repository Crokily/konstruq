import { mistral } from "@ai-sdk/mistral";
import { auth } from "@clerk/nextjs/server";
import { generateText } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  buildDatasetsContext,
  MAX_DATA_TOKENS,
  normalizeSheets,
  type DatasetContextItem,
} from "@/lib/ai/dataset-context";
import { db } from "@/lib/db";
import { resolveAppUserId } from "@/lib/db/app-user";
import { uploadedDatasets } from "@/lib/db/schema";
import {
  parseDashboardContent,
  type DashboardResponse,
} from "@/lib/dashboard/types";

const PREVIEW_ROW_LIMIT = 30;

const DASHBOARD_SYSTEM_PROMPT = [
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
  '- Color palette: ["#4f46e5","#06b6d4","#10b981","#f59e0b","#ef4444","#8b5cf6"]',
  "- Choose chart types by data nature: bar=comparisons, line/area=trends, pie=distributions, scatter=correlations.",
  "- Use only columns and values that actually exist in the provided datasets.",
  "- Ensure every chart includes the keys required by its type.",
  "- For scatter charts, use a numeric xKey and exactly one yKeys entry.",
  "- The data array for each chart must be plain JSON objects only.",
].join("\n");

function buildUserPrompt(datasets: DatasetContextItem[]): string {
  return [
    "Create an executive dashboard from these uploaded datasets.",
    "Prefer the most business-relevant metrics and aggregations you can infer from the available columns.",
    "If multiple datasets overlap, combine them only when the relationship is clear from the data.",
    "Do not invent columns, labels, or calculations that are not supported by the provided data.",
    buildDatasetsContext(datasets, {
      previewRowLimit: PREVIEW_ROW_LIMIT,
      maxDataTokens: MAX_DATA_TOKENS,
    }),
  ].join("\n\n");
}

function parseJsonText(text: string): unknown {
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

export async function POST() {
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

    const datasets = await db
      .select({
        id: uploadedDatasets.id,
        category: uploadedDatasets.category,
        fileName: uploadedDatasets.fileName,
        sheets: uploadedDatasets.sheets,
      })
      .from(uploadedDatasets)
      .where(
        and(
          eq(uploadedDatasets.userId, appUserId),
          eq(uploadedDatasets.isActive, true),
        ),
      )
      .orderBy(desc(uploadedDatasets.uploadedAt));

    const datasetContext: DatasetContextItem[] = datasets.map((dataset) => ({
      id: dataset.id,
      category: dataset.category,
      fileName: dataset.fileName,
      sheets: normalizeSheets(dataset.sheets),
    }));

    if (datasetContext.length === 0) {
      return NextResponse.json({
        datasetIds: [],
        kpis: [],
        charts: [],
      } satisfies DashboardResponse);
    }

    const result = await generateText({
      model: mistral("mistral-large-latest"),
      system: DASHBOARD_SYSTEM_PROMPT,
      prompt: buildUserPrompt(datasetContext),
      temperature: 0.2,
      maxSteps: 1,
    });

    const parsed = parseDashboardContent(parseJsonText(result.text));

    if (!parsed || parsed.charts.length === 0) {
      throw new Error("AI response did not contain valid dashboard charts");
    }

    return NextResponse.json({
      datasetIds: datasetContext.map((dataset) => dataset.id),
      kpis: parsed.kpis,
      charts: parsed.charts,
    } satisfies DashboardResponse);
  } catch (error) {
    console.error("Dashboard generation failed:", error);
    return NextResponse.json(
      { error: "Unable to generate dashboard right now" },
      { status: 500 },
    );
  }
}
