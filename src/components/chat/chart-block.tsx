"use client";

import type { ReactNode } from "react";
import { Info, Maximize2 } from "lucide-react";
import { ChartDataTable, getChartDataTableColumns } from "@/components/charts/chart-data-table";
import { ChartFromSpec } from "@/components/chat/chart-from-spec";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { NormalizeChartSpecResult } from "@/lib/charting/spec";

interface ChartBlockProps {
  result: NormalizeChartSpecResult;
  headerActions?: ReactNode;
}

interface ChartTabsContentProps {
  result: NormalizeChartSpecResult;
  hints: NormalizeChartSpecResult["hints"];
  tableContainerClassName?: string;
}

interface ResolvedMethodology {
  formula?: string;
  description?: string;
  assumptions: string[];
}

function resolveMethodology(
  methodology: NormalizeChartSpecResult["spec"]["methodology"],
): ResolvedMethodology | null {
  if (!methodology) {
    return null;
  }

  const formula = methodology.formula?.trim();
  const description = methodology.description?.trim();
  const assumptions =
    methodology.assumptions?.map((assumption) => assumption.trim()).filter((assumption) => assumption.length > 0) ?? [];

  if (!formula && !description && assumptions.length === 0) {
    return null;
  }

  return { formula, description, assumptions };
}

function MethodologyPopoverButton({ methodology }: { methodology: ResolvedMethodology }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label="View chart methodology">
          <Info className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 border-border bg-card text-foreground">
        <div className="space-y-3">
          {methodology.formula ? (
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Formula</p>
              <code className="block rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs text-foreground">
                {methodology.formula}
              </code>
            </div>
          ) : null}
          {methodology.description ? (
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
              <p className="text-sm leading-relaxed text-foreground">{methodology.description}</p>
            </div>
          ) : null}
          {methodology.assumptions.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Assumptions</p>
              <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
                {methodology.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ChartTabsContent({ result, hints, tableContainerClassName }: ChartTabsContentProps) {
  const columns = getChartDataTableColumns(result.spec);
  const rows = Array.isArray(result.spec.data) ? result.spec.data : [];

  return (
    <Tabs defaultValue="chart" className="w-full gap-4">
      <TabsList className="mb-2">
        <TabsTrigger value="chart">Chart</TabsTrigger>
        <TabsTrigger value="table">Table</TabsTrigger>
      </TabsList>
      <TabsContent value="chart" forceMount className="mt-2 data-[state=inactive]:hidden">
        <ChartFromSpec spec={result.spec} hints={hints} warnings={result.warnings} />
      </TabsContent>
      <TabsContent value="table" forceMount className="mt-2 data-[state=inactive]:hidden">
        <ChartDataTable columns={columns} data={rows} className={tableContainerClassName} rowKeyPrefix={result.spec.title} />
      </TabsContent>
    </Tabs>
  );
}

export function ChartBlock({ result, headerActions }: ChartBlockProps) {
  const fullScreenHints = {
    ...result.hints,
    height: Math.max(result.hints.height, 560),
    xAxisHeight: Math.max(result.hints.xAxisHeight, 90),
  };
  const methodology = resolveMethodology(result.spec.methodology);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/30 p-3">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {headerActions}
        {methodology ? <MethodologyPopoverButton methodology={methodology} /> : null}
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
          <DialogContent className="h-[92vh] max-w-[96vw] p-4 pr-12 sm:max-w-[96vw]">
            <DialogHeader className="flex flex-row items-start justify-between gap-3 pr-10 text-left">
              <DialogTitle className="min-w-0 text-base">{result.spec.title}</DialogTitle>
              {methodology ? <MethodologyPopoverButton methodology={methodology} /> : null}
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
