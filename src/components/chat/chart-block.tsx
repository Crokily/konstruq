"use client";

import { Maximize2 } from "lucide-react";
import { ChartFromSpec } from "@/components/chat/chart-from-spec";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { NormalizeChartSpecResult } from "@/lib/charting/spec";
import { cn } from "@/lib/utils";

interface ChartBlockProps {
  result: NormalizeChartSpecResult;
}

const numberFormatter = new Intl.NumberFormat();

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

function resolvePieTableKeys(spec: NormalizeChartSpecResult["spec"]) {
  const rawSpec = spec as unknown as Record<string, unknown>;
  const nameKey =
    typeof rawSpec.nameKey === "string" && rawSpec.nameKey.trim().length > 0
      ? rawSpec.nameKey
      : spec.xAxisKey;
  const valueKey =
    typeof rawSpec.valueKey === "string" && rawSpec.valueKey.trim().length > 0
      ? rawSpec.valueKey
      : spec.metrics[0]?.key ?? "value";

  return { nameKey, valueKey };
}

function getTableColumns(spec: NormalizeChartSpecResult["spec"]): string[] {
  if (spec.type === "pie") {
    const { nameKey, valueKey } = resolvePieTableKeys(spec);
    return Array.from(new Set([nameKey, valueKey]));
  }

  return Array.from(new Set([spec.xAxisKey, ...spec.metrics.map((metric) => metric.key)]));
}

interface ChartTabsContentProps {
  result: NormalizeChartSpecResult;
  hints: NormalizeChartSpecResult["hints"];
  tableContainerClassName?: string;
}

function ChartTabsContent({ result, hints, tableContainerClassName }: ChartTabsContentProps) {
  const columns = getTableColumns(result.spec);
  const rows = Array.isArray(result.spec.data)
    ? result.spec.data.filter((row): row is Record<string, unknown> => isRecord(row))
    : [];

  return (
    <Tabs defaultValue="chart" className="w-full gap-3">
      <TabsList>
        <TabsTrigger value="chart">Chart</TabsTrigger>
        <TabsTrigger value="table">Table</TabsTrigger>
      </TabsList>
      <TabsContent value="chart" forceMount className="mt-0 data-[state=inactive]:hidden">
        <ChartFromSpec spec={result.spec} hints={hints} warnings={result.warnings} />
      </TabsContent>
      <TabsContent value="table" forceMount className="mt-0 data-[state=inactive]:hidden">
        {columns.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
            No table columns available for this chart.
          </div>
        ) : (
          <div className={cn("max-h-[24rem] overflow-auto rounded-lg border border-border", tableContainerClassName)}>
            <Table className="min-w-full">
              <TableHeader className="bg-muted/40 [&_tr]:border-b-border">
                <TableRow className="border-border hover:bg-transparent">
                  {columns.map((column) => (
                    <TableHead key={column} className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, rowIndex) => (
                  <TableRow key={`${result.spec.title}-row-${rowIndex}`} className="border-border hover:bg-muted/60">
                    {columns.map((column) => {
                      const formatted = formatTableValue(row[column]);
                      return (
                        <TableCell
                          key={`${result.spec.title}-row-${rowIndex}-col-${column}`}
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
        )}
      </TabsContent>
    </Tabs>
  );
}

export function ChartBlock({ result }: ChartBlockProps) {
  const fullScreenHints = {
    ...result.hints,
    height: Math.max(result.hints.height, 560),
    xAxisHeight: Math.max(result.hints.xAxisHeight, 90),
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/30 p-3">
      <div className="mb-2 flex justify-end">
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 px-2.5 text-xs"
              aria-label="Open chart in full screen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Full screen
            </Button>
          </DialogTrigger>
          <DialogContent className="h-[92vh] max-w-[96vw] p-4 sm:max-w-[96vw]">
            <DialogHeader className="text-left">
              <DialogTitle className="text-base">{result.spec.title}</DialogTitle>
            </DialogHeader>
            <div className="h-[calc(92vh-5rem)] overflow-auto rounded-lg border border-border bg-background p-3">
              <ChartTabsContent
                result={result}
                hints={fullScreenHints}
                tableContainerClassName="max-h-[calc(92vh-14rem)]"
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <ChartTabsContent result={result} hints={result.hints} />
    </div>
  );
}
