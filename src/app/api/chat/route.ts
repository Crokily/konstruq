import { mistral } from "@ai-sdk/mistral";
import { auth } from "@clerk/nextjs/server";
import { streamText, type CoreMessage } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { uploadedDatasets, users } from "@/lib/db/schema";

const MAX_DATA_TOKENS = 20_000;
const PREVIEW_ROW_LIMIT = 8;
const MAX_DATASETS_IN_PROMPT = 6;

interface DatasetSheet {
  sheetName: string;
  columns: string[];
  rowCount: number;
  rows: Record<string, unknown>[];
}

interface DatasetContextItem {
  id: string;
  fileName: string;
  category: string;
  sheets: DatasetSheet[];
}

interface DatasetBudgetItem {
  dataset: DatasetContextItem;
  previewTokens: number;
  included: boolean;
}

function normalizeRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return [];
    }

    return [row as Record<string, unknown>];
  });
}

function normalizeSheets(value: unknown): DatasetSheet[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((sheet): DatasetSheet | null => {
      if (!sheet || typeof sheet !== "object" || Array.isArray(sheet)) {
        return null;
      }

      const rawSheet = sheet as Record<string, unknown>;
      const rows = normalizeRows(rawSheet.rows);
      const parsedRowCount = Number(rawSheet.rowCount);

      return {
        sheetName:
          typeof rawSheet.sheetName === "string" && rawSheet.sheetName.length > 0
            ? rawSheet.sheetName
            : "Sheet",
        columns: Array.isArray(rawSheet.columns)
          ? rawSheet.columns.filter(
              (column): column is string => typeof column === "string",
            )
          : [],
        rowCount: Number.isFinite(parsedRowCount)
          ? Math.max(0, parsedRowCount)
          : rows.length,
        rows,
      };
    })
    .filter((sheet): sheet is DatasetSheet => sheet !== null);
}

function estimateRowsTokens(sheets: DatasetSheet[], rowLimit: number): number {
  const rows = sheets.map((sheet) => sheet.rows.slice(0, rowLimit));
  return JSON.stringify(rows).length / 4;
}

function applyDataBudget(datasets: DatasetContextItem[]): {
  items: DatasetBudgetItem[];
  includedCount: number;
  omittedCount: number;
  totalDataTokens: number;
} {
  const items: DatasetBudgetItem[] = datasets.map((dataset) => ({
    dataset,
    previewTokens: estimateRowsTokens(dataset.sheets, PREVIEW_ROW_LIMIT),
    included: false,
  }));

  let remainingBudget = MAX_DATA_TOKENS;

  for (const [index, item] of items.entries()) {
    const canFit = item.previewTokens <= remainingBudget;

    if (canFit || index === 0) {
      item.included = true;
      remainingBudget = Math.max(0, remainingBudget - item.previewTokens);
    }
  }

  const includedCount = items.filter((item) => item.included).length;
  const omittedCount = items.length - includedCount;
  const totalDataTokens = items
    .filter((item) => item.included)
    .reduce((sum, item) => sum + item.previewTokens, 0);

  return {
    items,
    includedCount,
    omittedCount,
    totalDataTokens,
  };
}

function buildDatasetsContext(datasets: DatasetContextItem[]): string {
  if (datasets.length === 0) {
    return "Uploaded datasets context: no active datasets were found for this user.";
  }

  const { items, includedCount, omittedCount, totalDataTokens } =
    applyDataBudget(datasets);

  const sections = items
    .filter((item) => item.included)
    .map((item, index) => {
      const schema = item.dataset.sheets.map((sheet) => ({
        sheetName: sheet.sheetName,
        columns: sheet.columns,
        rowCount: sheet.rowCount,
      }));

      const rows = item.dataset.sheets.map((sheet) => ({
        sheetName: sheet.sheetName,
        rows: sheet.rows.slice(0, PREVIEW_ROW_LIMIT),
      }));

      return [
        `Dataset ${index + 1}`,
        `fileName: ${item.dataset.fileName}`,
        `category: ${item.dataset.category}`,
        `sheets: ${JSON.stringify(schema)}`,
        `rows: ${JSON.stringify(rows)}`,
        `note: rows are capped at first ${PREVIEW_ROW_LIMIT} rows per sheet for prompt size safety.`,
      ].join("\n");
    });

  const omissionNote =
    omittedCount > 0
      ? `Omitted ${omittedCount} active dataset(s) from prompt to stay within token budget. Ask the user to narrow scope if a missing dataset is needed.`
      : "No datasets were omitted.";

  return [
    `Uploaded datasets context (${datasets.length} active dataset(s); ${includedCount} included in prompt).`,
    `Data token budget: ${MAX_DATA_TOKENS}. Estimated data tokens sent: ${Math.ceil(totalDataTokens)}.`,
    omissionNote,
    sections.join("\n\n"),
  ].join("\n\n");
}

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

  return [basePrompt, outputFormatRules, buildDatasetsContext(datasets)].join(
    "\n\n",
  );
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let [appUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (!appUser) {
      await db
        .insert(users)
        .values({ clerkId: userId, email: "unknown@konstruq.app" })
        .onConflictDoNothing({ target: users.clerkId });

      [appUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, userId))
        .limit(1);
    }

    if (!appUser) {
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
          eq(uploadedDatasets.userId, appUser.id),
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
