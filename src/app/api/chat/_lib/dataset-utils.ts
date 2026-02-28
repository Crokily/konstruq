import type { DatasetRow, DatasetSheet, RowFilter } from "./types";

function normalizeRows(value: unknown): DatasetRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return [];
    }

    return [row as DatasetRow];
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

export function inferValueType(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

function compareAsNumber(
  left: unknown,
  right: string | number,
  predicate: (a: number, b: number) => boolean,
): boolean {
  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) {
    return false;
  }

  return predicate(leftNumber, rightNumber);
}

export function matchesFilter(row: DatasetRow, filter: RowFilter): boolean {
  const cell = row[filter.column];

  switch (filter.operator) {
    case "equals":
      return String(cell) === String(filter.value);
    case "contains":
      return String(cell ?? "")
        .toLowerCase()
        .includes(String(filter.value).toLowerCase());
    case "gt":
      return compareAsNumber(cell, filter.value, (a, b) => a > b);
    case "lt":
      return compareAsNumber(cell, filter.value, (a, b) => a < b);
    case "gte":
      return compareAsNumber(cell, filter.value, (a, b) => a >= b);
    case "lte":
      return compareAsNumber(cell, filter.value, (a, b) => a <= b);
    default:
      return false;
  }
}

export function applyRowFilter(rows: DatasetRow[], filter?: RowFilter): DatasetRow[] {
  if (!filter) {
    return rows;
  }

  return rows.filter((row) => matchesFilter(row, filter));
}

export function findSheet(
  sheets: DatasetSheet[],
  sheetName?: string,
): DatasetSheet | null {
  if (sheets.length === 0) {
    return null;
  }

  if (!sheetName) {
    return sheets[0];
  }

  return sheets.find((sheet) => sheet.sheetName === sheetName) ?? null;
}

export function projectRowsToColumns(
  rows: DatasetRow[],
  columns?: string[],
): DatasetRow[] {
  if (!columns?.length) {
    return rows;
  }

  return rows.map((row) =>
    Object.fromEntries(
      columns
        .filter((column) => column in row)
        .map((column) => [column, row[column]]),
    ),
  );
}
