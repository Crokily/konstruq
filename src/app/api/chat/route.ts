import { mistral } from "@ai-sdk/mistral";
import { auth } from "@clerk/nextjs/server";
import { streamText, type CoreMessage } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import {
  buildDatasetsContext,
  MAX_DATA_TOKENS,
  normalizeSheets,
  type DatasetContextItem,
} from "@/lib/ai/dataset-context";
import { db } from "@/lib/db";
import { resolveAppUserId } from "@/lib/db/app-user";
import { uploadedDatasets } from "@/lib/db/schema";

const PREVIEW_ROW_LIMIT = 8;
const MAX_DATASETS_IN_PROMPT = 6;

function buildSystemPrompt(datasets: DatasetContextItem[]): string {
  const basePrompt = [
    "You are Konstruq AI, a construction data analysis assistant.",
    "You help construction professionals analyze project data including costs, schedules, earned value metrics, and financial performance.",
    "Use the uploaded dataset context provided below to analyze user data.",
    "Always use actual data values from the datasets below and never make up numbers.",
    "If the available data is insufficient for a requested calculation, explicitly say what is missing.",
  ].join("\n");

  const outputFormatRules = [
    "Output format rules:",
    "- Use plain text for explanations.",
    "- Use ```chart code blocks for chart specs with this format:",
    "```chart",
    '{"type":"bar|line|area|pie|scatter|stacked-bar|composed","title":"...","xAxisKey":"...","metrics":[{"key":"...","label":"...","color":"#hex"}],"data":[...]}',
    "```",
    "- Use ```table code blocks for tabular data:",
    "```table",
    '{"headers":["col1","col2"],"rows":[["val1","val2"]]}',
    "```",
    "- Use ```kpi code blocks for KPI summaries:",
    "```kpi",
    '{"items":[{"label":"...","value":"...","trend":"up|down|neutral","description":"..."}]}',
    "```",
    "- Choose the most appropriate visualization type based on the user question.",
  ].join("\n");

  return [
    basePrompt,
    outputFormatRules,
    buildDatasetsContext(datasets, {
      previewRowLimit: PREVIEW_ROW_LIMIT,
      maxDataTokens: MAX_DATA_TOKENS,
    }),
  ].join("\n\n");
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUserId = await resolveAppUserId(userId);

    if (!appUserId) {
      return NextResponse.json(
        { error: "Unable to resolve user" },
        { status: 500 },
      );
    }

    if (!process.env.MISTRAL_API_KEY) {
      return NextResponse.json(
        { error: "MISTRAL_API_KEY is not configured" },
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
      .orderBy(desc(uploadedDatasets.uploadedAt))
      .limit(MAX_DATASETS_IN_PROMPT);

    const datasetContext: DatasetContextItem[] = datasets.map((dataset) => ({
      id: dataset.id,
      category: dataset.category,
      fileName: dataset.fileName,
      sheets: normalizeSheets(dataset.sheets),
    }));

    const body = (await request.json()) as {
      messages?: CoreMessage[];
    };

    const result = streamText({
      model: mistral("mistral-large-latest"),
      system: buildSystemPrompt(datasetContext),
      messages: Array.isArray(body.messages)
        ? (body.messages as CoreMessage[])
        : [],
    });

    return result.toDataStreamResponse({
      getErrorMessage(error) {
        console.error("Chat stream failed:", error);
        return "AI response failed. Try a shorter question or upload fewer/lighter datasets.";
      },
    });
  } catch (error) {
    console.error("Chat route failed:", error);
    return NextResponse.json(
      { error: "Unable to process chat request right now" },
      { status: 500 },
    );
  }
}
