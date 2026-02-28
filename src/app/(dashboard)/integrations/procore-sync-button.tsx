"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ProcoreSyncResponse {
  success?: boolean;
  total?: number;
  inserted?: number;
  updated?: number;
  skipped?: number;
  error?: string;
}

export function ProcoreSyncButton() {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setIsSyncing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/procore/sync", {
        method: "POST",
      });

      let payload: ProcoreSyncResponse | null = null;

      try {
        payload = (await response.json()) as ProcoreSyncResponse;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        setMessage(payload?.error ?? "Sync failed. Please try again.");
        return;
      }

      setMessage(
        `Synced ${payload?.total ?? 0} projects (${payload?.inserted ?? 0} new, ${
          payload?.updated ?? 0
        } updated).`,
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Sync failed. Please try again.",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleSync}
        disabled={isSyncing}
        className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
      >
        <Clock className="h-4 w-4" />
        {isSyncing ? "Syncing..." : "Sync Now"}
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
