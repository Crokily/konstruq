"use client";

import { Loader2 } from "lucide-react";

export function PageLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{label}...</span>
      </div>
    </div>
  );
}

