export const MAX_DATA_TOKENS = 20_000;

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
  previewTokens: number;
  included: boolean;
}

interface BuildDatasetsContextOptions {
  maxDataTokens?: number;
  previewRowLimit: number;
}

export function normalizeRows(value: unknown): Record<string, unknown>[] {
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

function applyDataBudget(
  datasets: DatasetContextItem[],
  {
    maxDataTokens = MAX_DATA_TOKENS,
    previewRowLimit,
  }: BuildDatasetsContextOptions,
): {
  items: DatasetBudgetItem[];
  includedCount: number;
  omittedCount: number;
  totalDataTokens: number;
} {
  const items: DatasetBudgetItem[] = datasets.map((dataset) => ({
    dataset,
    previewTokens: estimateRowsTokens(dataset.sheets, previewRowLimit),
    included: false,
  }));

  let remainingBudget = maxDataTokens;

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

export function buildDatasetsContext(
  datasets: DatasetContextItem[],
  options: BuildDatasetsContextOptions,
): string {
  if (datasets.length === 0) {
    return "Uploaded datasets context: no active datasets were found for this user.";
  }

  const {
    maxDataTokens = MAX_DATA_TOKENS,
    previewRowLimit,
  } = options;
  const { items, includedCount, omittedCount, totalDataTokens } =
    applyDataBudget(datasets, options);

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
        rows: sheet.rows.slice(0, previewRowLimit),
      }));

      return [
        `Dataset ${index + 1}`,
        `fileName: ${item.dataset.fileName}`,
        `category: ${item.dataset.category}`,
        `sheets: ${JSON.stringify(schema)}`,
        `rows: ${JSON.stringify(rows)}`,
        `note: rows are capped at first ${previewRowLimit} rows per sheet for prompt size safety.`,
      ].join("\n");
    });

  const omissionNote =
    omittedCount > 0
      ? `Omitted ${omittedCount} active dataset(s) from prompt to stay within token budget. Ask the user to narrow scope if a missing dataset is needed.`
      : "No datasets were omitted.";

  return [
    `Uploaded datasets context (${datasets.length} active dataset(s); ${includedCount} included in prompt).`,
    `Data token budget: ${maxDataTokens}. Estimated data tokens sent: ${Math.ceil(totalDataTokens)}.`,
    omissionNote,
    sections.join("\n\n"),
  ].join("\n\n");
}
