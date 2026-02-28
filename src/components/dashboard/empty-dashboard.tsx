import Link from "next/link";
import { ArrowRight, FileSpreadsheet, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyDashboardProps {
  firstName?: string | null;
}

export function EmptyDashboard({ firstName }: EmptyDashboardProps) {
  const welcomeName = firstName?.trim() ? firstName.trim() : "there";

  return (
    <Card className="relative overflow-hidden border-border bg-card">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.14),transparent_28%)]" />
      <CardContent className="relative flex flex-col gap-8 px-6 py-10 md:px-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-5">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium tracking-[0.16em] text-amber-300 uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            AI Dashboard Setup
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Welcome, {welcomeName}! Let&apos;s get started.
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              Upload your PM or ERP data files and Konstruq will generate an
              AI-driven dashboard with KPI cards and charts tailored to your
              datasets.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="bg-amber-500 text-amber-950 hover:bg-amber-400"
          >
            <Link href="/data-sources">
              Upload Your Data
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
          <div className="rounded-2xl border border-border bg-background/60 p-4 backdrop-blur">
            <FileSpreadsheet className="mb-3 h-5 w-5 text-amber-400" />
            <p className="text-sm font-medium text-foreground">CSV and Excel ready</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bring in spreadsheets from field, PM, or ERP workflows.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background/60 p-4 backdrop-blur">
            <Sparkles className="mb-3 h-5 w-5 text-cyan-400" />
            <p className="text-sm font-medium text-foreground">Auto-generated insights</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Charts and KPI cards are selected from your actual data shape.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
