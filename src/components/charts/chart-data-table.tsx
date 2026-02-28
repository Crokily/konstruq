"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ChartSpec as ChatChartSpec } from "@/lib/charting/spec";
import type { ChartSpec as DashboardChartSpec } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat();

type TableChartSpec = ChatChartSpec | DashboardChartSpec;

interface ChartDataTableProps {
  columns: string[];
  data: Array<Record<string, unknown>>;
  className?: string;
  rowKeyPrefix?: string;
  emptyColumnsMessage?: string;
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
    new Set(columns.map((column) => column.trim()).filter((column) => column.length > 0)),
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

function resolveChatPieTableKeys(spec: ChatChartSpec) {
  const rawSpec = spec as unknown as Record<string, unknown>;
  const nameKey =
    typeof rawSpec.nameKey === "string" && rawSpec.nameKey.trim().length > 0 ? rawSpec.nameKey : spec.xAxisKey;
  const valueKey =
    typeof rawSpec.valueKey === "string" && rawSpec.valueKey.trim().length > 0
      ? rawSpec.valueKey
      : spec.metrics[0]?.key ?? "value";

  return { nameKey, valueKey };
}

function isChatChartSpec(spec: TableChartSpec): spec is ChatChartSpec {
  return "xAxisKey" in spec;
}

export function getChartDataTableColumns(spec: TableChartSpec): string[] {
  const rows = Array.isArray(spec.data) ? spec.data.filter(isRecord) : [];

  if (isChatChartSpec(spec)) {
    const columns =
      spec.type === "pie"
        ? (() => {
            const pieKeys = resolveChatPieTableKeys(spec);
            return normalizeColumns([pieKeys.nameKey, pieKeys.valueKey]);
          })()
        : normalizeColumns([spec.xAxisKey, ...spec.metrics.map((metric) => metric.key)]);

    return columns.length > 0 ? columns : getColumnsFromDataRows(rows);
  }

  const columns =
    spec.type === "pie"
      ? normalizeColumns([spec.nameKey ?? "", spec.valueKey ?? ""])
      : normalizeColumns([spec.xKey ?? "", ...(spec.yKeys ?? [])]);

  return columns.length > 0 ? columns : getColumnsFromDataRows(rows);
}

export function ChartDataTable({
  columns,
  data,
  className,
  rowKeyPrefix = "chart-table",
  emptyColumnsMessage = "No table columns available for this chart.",
}: ChartDataTableProps) {
  const normalizedColumns = normalizeColumns(columns);
  const rows = Array.isArray(data) ? data.filter((row): row is Record<string, unknown> => isRecord(row)) : [];

  if (normalizedColumns.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
        {emptyColumnsMessage}
      </div>
    );
  }

  return (
    <div className={cn("max-h-[24rem] overflow-auto rounded-lg border border-border", className)}>
      <Table className="min-w-full">
        <TableHeader className="bg-muted/40 [&_tr]:border-b-border">
          <TableRow className="border-border hover:bg-transparent">
            {normalizedColumns.map((column) => (
              <TableHead key={column} className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={`${rowKeyPrefix}-row-${rowIndex}`} className="border-border hover:bg-muted/60">
              {normalizedColumns.map((column) => {
                const formatted = formatTableValue(row[column]);

                return (
                  <TableCell
                    key={`${rowKeyPrefix}-row-${rowIndex}-col-${column}`}
                    className={cn("px-3 py-2 text-sm text-foreground", formatted.isNumeric ? "text-right tabular-nums" : "")}
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
