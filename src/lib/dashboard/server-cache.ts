import type { DashboardResponse } from "@/lib/dashboard/types";

const DASHBOARD_CACHE_TTL_MS = 8 * 60 * 1000;

interface DashboardCacheEntry {
  value: DashboardResponse;
  expiresAt: number;
}

interface DashboardServerCacheStore {
  entries: Map<string, DashboardCacheEntry>;
  inFlight: Map<string, Promise<DashboardResponse>>;
}

function getStore(): DashboardServerCacheStore {
  const globalRef = globalThis as typeof globalThis & {
    __konstruqDashboardServerCache?: DashboardServerCacheStore;
  };

  if (!globalRef.__konstruqDashboardServerCache) {
    globalRef.__konstruqDashboardServerCache = {
      entries: new Map<string, DashboardCacheEntry>(),
      inFlight: new Map<string, Promise<DashboardResponse>>(),
    };
  }

  return globalRef.__konstruqDashboardServerCache;
}

export function readDashboardServerCache(key: string): DashboardResponse | null {
  const store = getStore();
  const entry = store.entries.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    store.entries.delete(key);
    return null;
  }

  return entry.value;
}

export function writeDashboardServerCache(key: string, value: DashboardResponse) {
  const store = getStore();
  store.entries.set(key, {
    value,
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
  });
}

export async function getOrCreateDashboardServerCache(
  key: string,
  factory: () => Promise<DashboardResponse>,
): Promise<DashboardResponse> {
  const cached = readDashboardServerCache(key);
  if (cached) {
    return cached;
  }

  const store = getStore();
  const pending = store.inFlight.get(key);
  if (pending) {
    return pending;
  }

  const request = factory()
    .then((value) => {
      writeDashboardServerCache(key, value);
      return value;
    })
    .finally(() => {
      store.inFlight.delete(key);
    });

  store.inFlight.set(key, request);
  return request;
}
