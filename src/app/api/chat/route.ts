import { mistral } from "@ai-sdk/mistral";
import { auth } from "@clerk/nextjs/server";
import { streamText, type CoreMessage } from "ai";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { uploadedDatasets, users } from "@/lib/db/schema";

const MAX_DATA_TOKENS = 80_000;
const PREVIEW_ROW_LIMIT = 20;

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
  fullTokens: number;
  truncatedTokens: number;
  includeFullRows: boolean;
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

function estimateRowsTokens(sheets: DatasetSheet[], rowLimit?: number): number {
  const rows = sheets.map((sheet) =>
    typeof rowLimit === "number" ? sheet.rows.slice(0, rowLimit) : sheet.rows,
  );

  return JSON.stringify(rows).length / 4;
}

function applyDataBudget(datasets: DatasetContextItem[]): {
  items: DatasetBudgetItem[];
  totalDataTokens: number;
} {
  const budgetItems: DatasetBudgetItem[] = datasets.map((dataset) => ({
    dataset,
    fullTokens: estimateRowsTokens(dataset.sheets),
    truncatedTokens: estimateRowsTokens(dataset.sheets, PREVIEW_ROW_LIMIT),
    includeFullRows: true,
  }));

  let totalDataTokens = budgetItems.reduce(
    (sum, item) => sum + item.fullTokens,
    0,
  );

  if (totalDataTokens > MAX_DATA_TOKENS) {
    const byLargestFirst = [...budgetItems].sort(
      (a, b) => b.fullTokens - a.fullTokens,
    );

    for (const item of byLargestFirst) {
      if (totalDataTokens <= MAX_DATA_TOKENS) {
        break;
      }

      item.includeFullRows = false;
      totalDataTokens = totalDataTokens - item.fullTokens + item.truncatedTokens;
    }
  }

  return {
    items: budgetItems,
    totalDataTokens,
  };
}

function buildDatasetsContext(datasets: DatasetContextItem[]): string {
  if (datasets.length === 0) {
    return "Uploaded datasets context: no active datasets were found for this user.";
  }

  const { items, totalDataTokens } = applyDataBudget(datasets);

  const sections = items.map((item, index) => {
    const schema = item.dataset.sheets.map((sheet) => ({
      sheetName: sheet.sheetName,
      columns: sheet.columns,
      rowCount: sheet.rowCount,
    }));

    const rows = item.dataset.sheets.map((sheet) => ({
      sheetName: sheet.sheetName,
      rows: item.includeFullRows
        ? sheet.rows
        : sheet.rows.slice(0, PREVIEW_ROW_LIMIT),
    }));

    const truncationNote = item.includeFullRows
      ? "Rows included in full."
      : `Rows truncated to first ${PREVIEW_ROW_LIMIT} rows per sheet to stay within the shared ${MAX_DATA_TOKENS} token data budget.`;

    return [
      `Dataset ${index + 1}`,
      `fileName: ${item.dataset.fileName}`,
      `category: ${item.dataset.category}`,
      `sheets: ${JSON.stringify(schema)}`,
      `rows: ${JSON.stringify(rows)}`,
      `note: ${truncationNote}`,
    ].join("\n");
  });

  return [
    `Uploaded datasets context (${items.length} active dataset(s)).`,
    `Data token budget: ${MAX_DATA_TOKENS}. Estimated data tokens after truncation strategy: ${Math.ceil(totalDataTokens)}.`,
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
      [appUser] = await db
        .insert(users)
        .values({ clerkId: userId, email: "unknown@konstruq.app" })
        .returning({ id: users.id });
    }

    if (!appUser) {
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
          eq(uploadedDatasets.userId, appUser.id),
          eq(uploadedDatasets.isActive, true),
        ),
      );

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

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat route failed:", error);
    return NextResponse.json(
      { error: "Unable to process chat request right now" },
      { status: 500 },
    );
  }
}
