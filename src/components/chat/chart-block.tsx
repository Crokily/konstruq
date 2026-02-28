"use client";

import { Maximize2 } from "lucide-react";
import { ChartFromSpec } from "@/components/chat/chart-from-spec";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { NormalizeChartSpecResult } from "@/lib/charting/spec";

interface ChartBlockProps {
  result: NormalizeChartSpecResult;
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
              <ChartFromSpec spec={result.spec} hints={fullScreenHints} warnings={result.warnings} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <ChartFromSpec spec={result.spec} hints={result.hints} warnings={result.warnings} />
    </div>
  );
}
