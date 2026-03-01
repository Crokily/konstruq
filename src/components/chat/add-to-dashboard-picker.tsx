"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCcw,
} from "lucide-react";

import type { MessageWidgetAddState } from "@/components/chat/message-renderer";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { Dashboard } from "@/lib/chat/use-add-to-dashboard";
import { cn } from "@/lib/utils";

interface AddToDashboardPickerProps {
  state: MessageWidgetAddState;
  dashboards: Dashboard[];
  dashboardsError?: string | null;
  isDashboardsLoading: boolean;
  onOpen: () => Promise<void> | void;
  onSelect: (dashboardId: string) => Promise<void>;
  className?: string;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unable to save this widget right now.";
}

export function AddToDashboardPicker({
  state,
  dashboards,
  dashboardsError,
  isDashboardsLoading,
  onOpen,
  onSelect,
  className,
}: AddToDashboardPickerProps) {
  const [open, setOpen] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  async function handleSelect(dashboardId: string) {
    setSelectionError(null);

    try {
      await onSelect(dashboardId);
      setOpen(false);
    } catch (error) {
      setSelectionError(toErrorMessage(error));
    }
  }

  async function handleRetryLoad() {
    setSelectionError(null);
    await onOpen();
  }

  const buttonClassName = cn("h-8 gap-1.5 px-2.5 text-xs", className);

  if (state === "loading") {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled
        className={buttonClassName}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Adding...
      </Button>
    );
  }

  if (state === "success" || state === "added") {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled
        className={buttonClassName}
      >
        <Check className="h-3.5 w-3.5" />
        Added
      </Button>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setSelectionError(null);

        if (nextOpen) {
          void onOpen();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={buttonClassName}
        >
          <Plus className="h-3.5 w-3.5" />
          Add to my dashboard
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <PopoverHeader className="gap-1 px-1 pb-2">
          <PopoverTitle>Save to dashboard</PopoverTitle>
          <PopoverDescription className="text-xs">
            Choose where this chart or KPI should be saved.
          </PopoverDescription>
        </PopoverHeader>

        {isDashboardsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : dashboardsError ? (
          <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs text-destructive">{dashboardsError}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleRetryLoad()}
              className="w-full justify-center"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        ) : dashboards.length === 0 ? (
          <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              You don&apos;t have a dashboard yet.
            </p>
            <Button asChild size="sm" className="w-full">
              <Link href="/dashboards">Create a dashboard</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {dashboards.map((dashboard) => (
                <button
                  key={dashboard.id}
                  type="button"
                  onClick={() => void handleSelect(dashboard.id)}
                  disabled={state !== "idle"}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:border-amber-500/40 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {dashboard.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {dashboard.widgetCount} widget
                      {dashboard.widgetCount === 1 ? "" : "s"}
                    </span>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
                </button>
              ))}
            </div>

            {selectionError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {selectionError}
              </p>
            ) : null}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
