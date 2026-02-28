"use client";

import { Loader2 } from "lucide-react";

export function PageLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center rounded-xl border border-border/60 bg-background">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>{label}...</span>
      </div>
    </div>
  );
}
