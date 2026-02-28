"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react";

import { DynamicChart } from "@/components/charts/dynamic-chart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildDashboardCacheKey,
  DASHBOARD_STORAGE_KEY,
  parseDashboardCache,
  parseDashboardResponse,
  type DashboardCache,
  type DashboardResponse,
  type KPIItem,
} from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

type DashboardVariant = "executive" | "project-controls" | "financials";

interface DashboardClientProps {
  datasetIds: string[];
  firstName?: string | null;
  projectId?: string;
  variant?: DashboardVariant;
}

interface ApiErrorPayload {
  error?: string;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

let inFlightRequestKey: string | null = null;
let inFlightRequest: Promise<DashboardResponse> | null = null;

function formatKPIValue(item: KPIItem): string {
  if (typeof item.value === "string") {
    return item.value;
  }

  if (item.format === "currency") {
    return currencyFormatter.format(item.value);
  }

  if (item.format === "percentage") {
    const percentageValue =
      Math.abs(item.value) <= 1 ? item.value * 100 : item.value;

    return `${numberFormatter.format(percentageValue)}%`;
  }

  if (item.format === "number") {
    return numberFormatter.format(item.value);
  }

  return String(item.value);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Unable to generate your dashboard right now.";
}

function readCache(): DashboardCache | null {
  return parseDashboardCache(window.localStorage.getItem(DASHBOARD_STORAGE_KEY));
}

function writeCache(data: DashboardResponse, cacheKey: string) {
  const cache: DashboardCache = {
    cacheKey,
    kpis: data.kpis,
    charts: data.charts,
  };

  window.localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(cache));
}

function clearCache() {
  window.localStorage.removeItem(DASHBOARD_STORAGE_KEY);
}

async function requestDashboard(
  cacheKey: string,
  projectId?: string,
  variant?: DashboardVariant,
): Promise<DashboardResponse> {
  const requestKey = `${cacheKey}:${projectId ?? ""}:${variant ?? ""}`;

  if (inFlightRequest && inFlightRequestKey === requestKey) {
    return inFlightRequest;
  }

  const request = fetch("/api/dashboard/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(projectId ? { projectId } : {}),
      ...(variant ? { variant } : {}),
    }),
    cache: "no-store",
  }).then(async (response) => {
    const payload = (await response.json().catch(() => null)) as
      | DashboardResponse
      | ApiErrorPayload
      | null;

    if (!response.ok) {
      const message =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : "Dashboard generation failed";

      throw new Error(message);
    }

    const parsed = parseDashboardResponse(payload);

    if (!parsed) {
      throw new Error("Dashboard response was invalid");
    }

    return parsed;
  });

  inFlightRequestKey = requestKey;
  inFlightRequest = request;

  try {
    return await request;
  } finally {
    if (inFlightRequest === request) {
      inFlightRequest = null;
      inFlightRequestKey = null;
    }
  }
}

function DynamicKPICard({
  item,
  index,
}: {
  item: KPIItem;
  index: number;
}) {
  const accentStyles = [
    "from-amber-500/16 to-amber-500/0 border-amber-500/15",
    "from-cyan-500/16 to-cyan-500/0 border-cyan-500/15",
    "from-emerald-500/16 to-emerald-500/0 border-emerald-500/15",
    "from-rose-500/16 to-rose-500/0 border-rose-500/15",
    "from-violet-500/16 to-violet-500/0 border-violet-500/15",
  ] as const;

  return (
    <Card
      className={cn(
        "gap-4 overflow-hidden border bg-card/95 py-5",
        "bg-gradient-to-br",
        accentStyles[index % accentStyles.length],
      )}
    >
      <CardContent className="px-5">
        <p className="text-sm text-muted-foreground">{item.label}</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          {formatKPIValue(item)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {item.description ?? "Derived directly from your uploaded datasets."}
        </p>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-4 gap-4 max-2xl:grid-cols-2 max-md:grid-cols-1">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton
            key={`dashboard-kpi-skeleton-${index}`}
            className="h-28 w-full rounded-xl border border-slate-800 bg-slate-800/70"
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={`dashboard-chart-skeleton-${index}`}
            className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6"
          >
            <Skeleton className="h-6 w-40 bg-slate-800" />
            <Skeleton className="h-4 w-56 bg-slate-800" />
            <Skeleton className="h-72 w-full rounded-lg bg-slate-800/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardError({
  message,
  onRetry,
  isPending,
}: {
  message: string;
  onRetry: () => void;
  isPending: boolean;
}) {
  return (
    <Card className="border-destructive/30 bg-card">
      <CardContent className="flex flex-col items-start gap-4 px-6 py-8">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <p className="text-base font-medium text-foreground">
              Dashboard generation failed
            </p>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        <Button type="button" onClick={onRetry} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

export function DashboardClient({
  datasetIds,
  firstName,
  projectId,
  variant,
}: DashboardClientProps) {
  const cacheKey = [
    buildDashboardCacheKey(datasetIds),
    projectId ?? "",
    variant ?? "executive",
  ].join(":");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isPending, startTransition] = useTransition();
  const requestIdRef = useRef(0);

  const loadDashboard = useEffectEvent(async ({ force }: { force: boolean }) => {
    const requestId = ++requestIdRef.current;

    if (!force) {
      const cached = readCache();

      if (cached?.cacheKey === cacheKey) {
        setDashboard({
          datasetIds,
          kpis: cached.kpis,
          charts: cached.charts,
        });
        setMessage("");
        setStatus("ready");
        return;
      }
    }

    setStatus("loading");
    setMessage("");

    try {
      const nextDashboard = await requestDashboard(cacheKey, projectId, variant);

      if (requestId !== requestIdRef.current) {
        return;
      }

      writeCache(nextDashboard, cacheKey);
      setDashboard(nextDashboard);
      setStatus("ready");
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setMessage(errorMessage(error));
      setStatus("error");
    }
  });

  useEffect(() => {
    void loadDashboard({ force: refreshKey > 0 });
  }, [cacheKey, projectId, refreshKey, variant]);

  function handleRefresh() {
    clearCache();
    startTransition(() => {
      setRefreshKey((current) => current + 1);
    });
  }

  const welcomeName = firstName?.trim() ? firstName.trim() : "there";
  const controlsDisabled = status === "loading" || isPending;
  const groupedCharts = useMemo(() => {
    if (!dashboard) {
      return [] as Array<[string, DashboardResponse["charts"]]>;
    }

    const groups = new Map<string, DashboardResponse["charts"]>();

    for (const chart of dashboard.charts) {
      const key = chart.group || "General";
      const existing = groups.get(key);

      if (existing) {
        existing.push(chart);
      } else {
        groups.set(key, [chart]);
      }
    }

    return Array.from(groups.entries());
  }, [dashboard]);
  const hasChartGroups = useMemo(
    () =>
      dashboard
        ? dashboard.charts.some(
            (chart) =>
              typeof chart.group === "string" && chart.group.trim().length > 0,
          )
        : false,
    [dashboard],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium tracking-[0.16em] text-cyan-300 uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Generated Dashboard
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Welcome back, {welcomeName}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Your dashboard is generated from {datasetIds.length} active dataset
              {datasetIds.length === 1 ? "" : "s"} and cached locally for faster reloads.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleRefresh}
          disabled={controlsDisabled}
          className="self-start"
        >
          <RefreshCw
            className={cn(
              "h-4 w-4",
              controlsDisabled ? "animate-spin" : "",
            )}
          />
          Refresh
        </Button>
      </div>

      {status === "loading" ? <DashboardSkeleton /> : null}

      {status === "error" ? (
        <DashboardError
          message={message}
          onRetry={handleRefresh}
          isPending={isPending}
        />
      ) : null}

      {status === "ready" && dashboard ? (
        <>
          {dashboard.kpis.length > 0 ? (
            <div className="grid grid-cols-4 gap-4 max-2xl:grid-cols-2 max-md:grid-cols-1">
              {dashboard.kpis.map((item, index) => (
                <DynamicKPICard key={`${item.label}-${index}`} item={item} index={index} />
              ))}
            </div>
          ) : null}

          {hasChartGroups ? (
            <div className="space-y-8">
              {groupedCharts.map(([groupName, charts]) => (
                <div key={groupName} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">
                      {groupName}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {charts.length} chart{charts.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
                    {charts.map((chart) => (
                      <Card key={chart.id} className="border-border bg-card py-0">
                        <CardHeader className="pb-4 pt-6">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <CardTitle>{chart.title}</CardTitle>
                              <CardDescription>
                                {chart.type === "pie"
                                  ? "AI-selected distribution view"
                                  : chart.type === "scatter"
                                    ? "AI-selected relationship view"
                                    : "AI-selected trend and comparison view"}
                              </CardDescription>
                            </div>
                            <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                              {chart.type}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="pb-6">
                          <DynamicChart chart={chart} />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
              {dashboard.charts.map((chart) => (
                <Card key={chart.id} className="border-border bg-card py-0">
                  <CardHeader className="pb-4 pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle>{chart.title}</CardTitle>
                        <CardDescription>
                          {chart.type === "pie"
                            ? "AI-selected distribution view"
                            : chart.type === "scatter"
                              ? "AI-selected relationship view"
                              : "AI-selected trend and comparison view"}
                        </CardDescription>
                      </div>
                      <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                        {chart.type}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-6">
                    <DynamicChart chart={chart} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
