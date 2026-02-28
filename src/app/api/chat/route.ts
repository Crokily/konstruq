import { mistral } from "@ai-sdk/mistral";
import { auth } from "@clerk/nextjs/server";
import { streamText, type CoreMessage } from "ai";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { uploadedDatasets, users } from "@/lib/db/schema";
import { buildChartSelectionPolicyPrompt } from "@/lib/charting/policy";

const MAX_DATA_TOKENS = 30_000;
const PREVIEW_ROW_LIMIT = 20;
const MAX_MESSAGE_COUNT = 16;
const MAX_MESSAGES_TOKENS = 22_000;
const MAX_SINGLE_MESSAGE_CHARS = 6_000;

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

function buildSystemPrompt(
  datasets: DatasetContextItem[],
  userQuestion?: string,
): string {
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
    '{"type":"bar|line|area|pie|scatter|stacked-bar|composed","title":"...","subtitle":"...","xAxisKey":"...","metrics":[{"key":"...","label":"...","color":"#hex"}],"sources":[{"fileName":"...","sheetName":"...","columns":["exactColumnA","exactColumnB"]}],"selection":{"domain":"construction|finance|healthcare|retail|general","intent":"composition|trend|ranking|distribution|relationship|deviation|forecast","rationale":"...","fallback":"..."},"data":[...]}',
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
    "- The chart `selection` object must include domain, intent, rationale, and fallback.",
    "- Every chart MUST include `sources` with exact fileName + sheetName + columns from uploaded datasets.",
    "- Every `metrics[].key` and `xAxisKey` must appear in `sources.columns` exactly.",
    "- If you cannot cite exact uploaded-file sources for a chart, DO NOT output a chart block; return text only.",
    "- For percentage/share questions: use pie when categories <= 6, otherwise use sorted bar.",
    "- For trend-over-time questions: use line/area.",
    "- For comparison/ranking questions: use bar/column.",
    "- Apply chart style spec: concise title, useful subtitle with scope/period, consistent series colors, readable axis labels, and avoid clutter.",
    "- Avoid pie charts for dense categories; prefer sorted or stacked bars when readability is at risk.",
    "- Charts are rendered with shadcn chart components; provide clean, valid fields so shadcn chart rendering works without manual correction.",
  ].join("\n");

  const chartPolicy = buildChartSelectionPolicyPrompt(
    datasets.map((dataset) => ({
      category: dataset.category,
      fileName: dataset.fileName,
      sheets: dataset.sheets.map((sheet) => ({
        sheetName: sheet.sheetName,
        columns: sheet.columns,
        rowCount: sheet.rowCount,
      })),
    })),
    userQuestion,
  );

  return [basePrompt, outputFormatRules, chartPolicy, buildDatasetsContext(datasets)].join(
    "\n\n",
  );
}

function estimateTextTokens(value: string): number {
  return Math.ceil(value.length / 4);
}

function compactMessageContent(raw: string): string {
  const trimmed = raw.trim();

  if (trimmed.length <= MAX_SINGLE_MESSAGE_CHARS) {
    return trimmed;
  }

  const chartBlockMatches = [...trimmed.matchAll(/```chart[\s\S]*?```/g)];
  if (chartBlockMatches.length > 0) {
    const latestChartBlock = chartBlockMatches[chartBlockMatches.length - 1]?.[0] ?? "";
    const prefix = trimmed.slice(0, Math.min(1_500, trimmed.length));
    return `${prefix}\n\n[older content truncated for token budget]\n\n${latestChartBlock}`.slice(
      0,
      MAX_SINGLE_MESSAGE_CHARS,
    );
  }

  return `${trimmed.slice(0, MAX_SINGLE_MESSAGE_CHARS)}\n\n[content truncated for token budget]`;
}

function normalizeMessageContent(
  content: CoreMessage["content"],
): string | null {
  if (typeof content === "string") {
    return compactMessageContent(content);
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          part.type === "text" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .join("\n")
      .trim();

    return text.length > 0 ? compactMessageContent(text) : null;
  }

  return null;
}

function budgetMessages(messages: CoreMessage[]): CoreMessage[] {
  if (messages.length === 0) {
    return [];
  }

  const recent = messages.slice(-MAX_MESSAGE_COUNT);
  const budgeted: CoreMessage[] = [];
  let usedTokens = 0;

  // Keep newest messages first, then reverse at the end.
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const message = recent[index];

    if (
      message.role !== "system" &&
      message.role !== "user" &&
      message.role !== "assistant"
    ) {
      continue;
    }

    const normalizedContent = normalizeMessageContent(message.content);

    if (!normalizedContent) {
      continue;
    }

    const estimated = estimateTextTokens(normalizedContent);
    if (usedTokens + estimated > MAX_MESSAGES_TOKENS) {
      continue;
    }

    usedTokens += estimated;
    budgeted.push({
      role: message.role,
      content: normalizedContent,
    });
  }

  return budgeted.reverse();
}

function latestUserTextMessage(messages: CoreMessage[]): string | undefined {
  const userMessages = messages.filter((message) => message.role === "user");
  const last = userMessages[userMessages.length - 1];

  if (!last) {
    return undefined;
  }

  if (typeof last.content === "string") {
    return last.content;
  }

  if (Array.isArray(last.content)) {
    const textParts = last.content
      .map((part) => {
        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          part.type === "text" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .filter((text) => text.length > 0);

    return textParts.length > 0 ? textParts.join("\n") : undefined;
  }

  return undefined;
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

    const rawMessages = Array.isArray(body.messages)
      ? (body.messages as CoreMessage[])
      : [];
    const messages = budgetMessages(rawMessages);
    const question = latestUserTextMessage(messages);

    const result = streamText({
      model: mistral("mistral-large-latest"),
      system: buildSystemPrompt(datasetContext, question),
      messages,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat route failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process chat request right now",
      },
      { status: 500 },
    );
  }
}
