"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, Info, Loader2, Sparkles } from "lucide-react";

import { ChartDataTable, getChartDataTableColumns } from "@/components/charts/chart-data-table";
import { DynamicChart } from "@/components/charts/dynamic-chart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageLoading } from "@/components/ui/page-loading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DASHBOARD_STORAGE_KEY,
  parseDashboardCacheStore,
  parseDashboardResponse,
  type ChartSpec,
  type DashboardCacheEntry,
  type DashboardCacheStore,
  type DashboardResponse,
  type KPIItem,
} from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

type DashboardVariant = "executive" | "project-controls" | "financials";

interface DashboardClientProps {
  datasetIds: string[];
  cacheKey: string;
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

const MAX_CACHE_ENTRIES = 20;

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

function readCacheStore(): DashboardCacheStore {
  return (
    parseDashboardCacheStore(window.localStorage.getItem(DASHBOARD_STORAGE_KEY)) ?? {
      entries: {},
    }
  );
}

function persistCacheStore(store: DashboardCacheStore) {
  if (Object.keys(store.entries).length === 0) {
    window.localStorage.removeItem(DASHBOARD_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(store));
}

function readCacheEntry(cacheKey: string): DashboardCacheEntry | null {
  return readCacheStore().entries[cacheKey] ?? null;
}

function writeCacheEntry(data: DashboardResponse, cacheKey: string) {
  const nextEntries = {
    ...readCacheStore().entries,
    [cacheKey]: {
      kpis: data.kpis,
      charts: data.charts,
      savedAt: new Date().toISOString(),
    } satisfies DashboardCacheEntry,
  };

  const limitedEntries = Object.fromEntries(
    Object.entries(nextEntries)
      .sort(([, left], [, right]) => {
        const leftTime = new Date(left.savedAt).getTime();
        const rightTime = new Date(right.savedAt).getTime();
        return rightTime - leftTime;
      })
      .slice(0, MAX_CACHE_ENTRIES),
  );

  persistCacheStore({ entries: limitedEntries });
}

function clearCacheEntry(cacheKey: string) {
  const store = readCacheStore();

  if (!(cacheKey in store.entries)) {
    return;
  }

  delete store.entries[cacheKey];
  persistCacheStore(store);
}

async function requestDashboard(
  cacheKey: string,
  projectId?: string,
  variant?: DashboardVariant,
): Promise<DashboardResponse> {
  const requestKey = cacheKey;

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

function MethodologyPopover({ chart }: { chart: ChartSpec }) {
  if (!chart.methodology) return null;
  const { formula, description, assumptions } = chart.methodology;
  if (!formula && !description && (!assumptions || assumptions.length === 0)) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0" aria-label="View methodology">
          <Info className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-border bg-card text-foreground" side="bottom" align="end">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Methodology</p>
          {formula ? <code className="block rounded bg-muted px-2 py-1 font-mono text-xs">{formula}</code> : null}
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          {assumptions && assumptions.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              {assumptions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DashboardChartCard({ chart }: { chart: ChartSpec }) {
  const columns = getChartDataTableColumns(chart);

  return (
    <Card className="border-border bg-card py-0">
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
          <div className="flex items-center gap-1.5">
            <MethodologyPopover chart={chart} />
            <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              {chart.type}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-6">
        <Tabs defaultValue="chart" className="w-full">
          <TabsList className="mb-3 h-8">
            <TabsTrigger value="chart" className="text-xs">Chart</TabsTrigger>
            <TabsTrigger value="table" className="text-xs">Table</TabsTrigger>
          </TabsList>
          <TabsContent value="chart">
            <DynamicChart chart={chart} />
          </TabsContent>
          <TabsContent value="table">
            <ChartDataTable columns={columns} data={chart.data} className="max-h-80 overflow-auto" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export function DashboardClient({
  datasetIds,
  cacheKey,
  firstName,
  projectId,
  variant,
}: DashboardClientProps) {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const requestIdRef = useRef(0);

  const loadDashboard = useEffectEvent(async ({ force }: { force: boolean }) => {
    const requestId = ++requestIdRef.current;

    if (!force) {
      const cached = readCacheEntry(cacheKey);

      if (cached) {
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

    if (!dashboard) {
      setStatus("loading");
    }
    setMessage("");
    setIsRefreshing(true);

    try {
      const nextDashboard = await requestDashboard(cacheKey, projectId, variant);

      if (requestId !== requestIdRef.current) {
        return;
      }

      writeCacheEntry(nextDashboard, cacheKey);
      setDashboard(nextDashboard);
      setStatus("ready");
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setMessage(errorMessage(error));
      setStatus("error");
    } finally {
      if (requestId === requestIdRef.current) {
        setIsRefreshing(false);
      }
    }
  });

  useEffect(() => {
    void loadDashboard({ force: false });
  }, [cacheKey, datasetIds]);

  const welcomeName = firstName?.trim() ? firstName.trim() : "there";
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
      <div className="flex flex-col gap-4">
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
              {datasetIds.length === 1 ? "" : "s"} 
            </p>
          </div>
        </div>
      </div>

      {status === "loading" && !dashboard ? <PageLoading label="Loading dashboard" /> : null}

      {status === "error" ? (
        <DashboardError
          message={message}
          onRetry={() => {
            clearCacheEntry(cacheKey);
            void loadDashboard({ force: true });
          }}
          isPending={isRefreshing}
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
                      <DashboardChartCard key={chart.id} chart={chart} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
              {dashboard.charts.map((chart) => (
                <DashboardChartCard key={chart.id} chart={chart} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
