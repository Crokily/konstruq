export const MAX_DATA_TOKENS = 12_000;
export const PREVIEW_ROW_LIMIT = 10;

export interface DatasetSheet {
  sheetName: string;
  columns: string[];
  rowCount: number;
  rows: Record<string, unknown>[];
}

export interface DatasetContextItem {
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

export function normalizeSheets(value: unknown): DatasetSheet[] {
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
          ? rawSheet.columns.filter((column): column is string => typeof column === "string")
          : [],
        rowCount: Number.isFinite(parsedRowCount) ? Math.max(0, parsedRowCount) : rows.length,
        rows,
      };
    })
    .filter((sheet): sheet is DatasetSheet => sheet !== null);
}

function estimateRowsTokens(sheets: DatasetSheet[], rowLimit?: number): number {
  const rows = sheets.map((sheet) => (typeof rowLimit === "number" ? sheet.rows.slice(0, rowLimit) : sheet.rows));
  return JSON.stringify(rows).length / 4;
}

function applyDataBudget(datasets: DatasetContextItem[]) {
  const budgetItems: DatasetBudgetItem[] = datasets.map((dataset) => ({
    dataset,
    fullTokens: estimateRowsTokens(dataset.sheets),
    truncatedTokens: estimateRowsTokens(dataset.sheets, PREVIEW_ROW_LIMIT),
    includeFullRows: true,
  }));

  let totalDataTokens = budgetItems.reduce((sum, item) => sum + item.fullTokens, 0);

  if (totalDataTokens > MAX_DATA_TOKENS) {
    const byLargestFirst = [...budgetItems].sort((a, b) => b.fullTokens - a.fullTokens);

    for (const item of byLargestFirst) {
      if (totalDataTokens <= MAX_DATA_TOKENS) {
        break;
      }

      item.includeFullRows = false;
      totalDataTokens = totalDataTokens - item.fullTokens + item.truncatedTokens;
    }
  }

  return { items: budgetItems, totalDataTokens };
}

export function buildDatasetsContext(datasets: DatasetContextItem[]): string {
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
      rows: item.includeFullRows ? sheet.rows : sheet.rows.slice(0, PREVIEW_ROW_LIMIT),
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
