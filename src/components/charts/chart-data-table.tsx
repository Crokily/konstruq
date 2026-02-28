"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Loose shape covering both dashboard ChartSpec and chat ChartSpec */
interface ChartSpecLike {
  type?: string;
  data?: unknown[];
  nameKey?: string;
  valueKey?: string;
  xKey?: string;
  yKeys?: string[];
  xAxisKey?: string;
  metrics?: Array<{ key: string }>;
}

const numberFormatter = new Intl.NumberFormat();

interface ChartDataTableProps {
  columns: string[];
  data: Array<Record<string, unknown>>;
  className?: string;
  rowKeyPrefix?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNumericString(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "");

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTableValue(value: unknown): { text: string; isNumeric: boolean } {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { text: numberFormatter.format(value), isNumeric: true };
  }

  if (typeof value === "string") {
    const parsed = parseNumericString(value);

    if (parsed !== null) {
      return { text: numberFormatter.format(parsed), isNumeric: true };
    }

    return { text: value, isNumeric: false };
  }

  if (value === null || value === undefined) {
    return { text: "—", isNumeric: false };
  }

  if (typeof value === "boolean") {
    return { text: value ? "true" : "false", isNumeric: false };
  }

  return { text: JSON.stringify(value), isNumeric: false };
}

function normalizeColumns(columns: string[]): string[] {
  return Array.from(
    new Set(
      columns
        .map((column) => column.trim())
        .filter((column) => column.length > 0),
    ),
  );
}

function getColumnsFromDataRows(data: Array<Record<string, unknown>>): string[] {
  const columns = new Set<string>();

  for (const row of data) {
    for (const key of Object.keys(row)) {
      if (key.trim().length > 0) {
        columns.add(key);
      }
    }
  }

  return Array.from(columns);
}

export function getChartDataTableColumns(spec: ChartSpecLike): string[] {
  const rows = Array.isArray(spec.data) ? spec.data.filter(isRecord) : [];

  // Dashboard ChartSpec uses xKey/yKeys; Chat ChartSpec uses xAxisKey/metrics
  const columns =
    spec.type === "pie"
      ? normalizeColumns([spec.nameKey ?? "", spec.valueKey ?? ""])
      : normalizeColumns([
          spec.xKey ?? spec.xAxisKey ?? "",
          ...(spec.yKeys ?? spec.metrics?.map((m) => m.key) ?? []),
        ]);

  return columns.length > 0 ? columns : getColumnsFromDataRows(rows);
}

export function ChartDataTable({
  columns,
  data,
  className,
  rowKeyPrefix = "chart-table",
}: ChartDataTableProps) {
  const normalizedColumns = normalizeColumns(columns);
  const rows = Array.isArray(data)
    ? data.filter((row): row is Record<string, unknown> => isRecord(row))
    : [];

  if (normalizedColumns.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
        No table columns available for this chart.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "max-h-[24rem] overflow-auto rounded-lg border border-border",
        className,
      )}
    >
      <Table className="min-w-full">
        <TableHeader className="bg-muted/40 [&_tr]:border-b-border">
          <TableRow className="border-border hover:bg-transparent">
            {normalizedColumns.map((column) => (
              <TableHead
                key={column}
                className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground"
              >
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow
              key={`${rowKeyPrefix}-row-${rowIndex}`}
              className="border-border hover:bg-muted/60"
            >
              {normalizedColumns.map((column) => {
                const formatted = formatTableValue(row[column]);

                return (
                  <TableCell
                    key={`${rowKeyPrefix}-row-${rowIndex}-col-${column}`}
                    className={cn(
                      "px-3 py-2 text-sm text-foreground",
                      formatted.isNumeric ? "text-right tabular-nums" : "",
                    )}
                  >
                    {formatted.text}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
