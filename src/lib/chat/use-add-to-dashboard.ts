"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  MessageWidgetAddRequest,
  MessageWidgetAddState,
} from "@/components/chat/message-renderer";
import { buildCreateDashboardWidgetRequest } from "@/lib/dashboard/widget-request";

const ADD_WIDGET_SUCCESS_DURATION_MS = 2000;

interface ApiErrorPayload {
  error?: string;
}

export interface Dashboard {
  id: string;
  name: string;
  widgetCount: number;
}

interface UseAddToDashboardOptions {
  projectId?: string;
  resetKey?: string;
}

interface UseAddToDashboardReturn {
  dashboards: Dashboard[];
  dashboardsError: string | null;
  isDashboardsLoading: boolean;
  fetchDashboards: () => Promise<void>;
  addToDashboard: (
    widget: MessageWidgetAddRequest,
    dashboardId: string,
  ) => Promise<void>;
  getWidgetState: (blockKey: string) => MessageWidgetAddState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return isRecord(value) && typeof value.error === "string";
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function parseDashboards(payload: unknown): Dashboard[] {
  if (!Array.isArray(payload)) {
    throw new Error("Failed to load dashboards");
  }

  return payload.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const id = typeof item.id === "string" ? item.id.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const widgetCount =
      typeof item.widgetCount === "number" && Number.isFinite(item.widgetCount)
        ? Math.max(0, Math.trunc(item.widgetCount))
        : 0;

    if (!id || !name) {
      return [];
    }

    return [{ id, name, widgetCount }];
  });
}

export function useAddToDashboard({
  projectId = "",
  resetKey,
}: UseAddToDashboardOptions = {}): UseAddToDashboardReturn {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [dashboardsError, setDashboardsError] = useState<string | null>(null);
  const [isDashboardsLoading, setIsDashboardsLoading] = useState(false);
  const [widgetStates, setWidgetStates] = useState<Map<string, MessageWidgetAddState>>(
    () => new Map(),
  );
  const dashboardsLoadedRef = useRef(false);
  const dashboardsRequestRef = useRef<Promise<void> | null>(null);
  const dashboardsRequestVersionRef = useRef(0);
  const widgetStateTimeoutsRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  const widgetStatesRef = useRef(widgetStates);
  const previousProjectIdRef = useRef(projectId);
  const previousResetKeyRef = useRef(resetKey);

  useEffect(() => {
    widgetStatesRef.current = widgetStates;
  }, [widgetStates]);

  const clearAddWidgetTimeout = useCallback((blockKey: string) => {
    const timeoutId = widgetStateTimeoutsRef.current.get(blockKey);

    if (!timeoutId) {
      return;
    }

    clearTimeout(timeoutId);
    widgetStateTimeoutsRef.current.delete(blockKey);
  }, []);

  const clearAllAddWidgetTimeouts = useCallback(() => {
    widgetStateTimeoutsRef.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    widgetStateTimeoutsRef.current.clear();
  }, []);

  const resetWidgetStates = useCallback(() => {
    clearAllAddWidgetTimeouts();
    widgetStatesRef.current = new Map();
    setWidgetStates(new Map());
  }, [clearAllAddWidgetTimeouts]);

  useEffect(() => clearAllAddWidgetTimeouts, [clearAllAddWidgetTimeouts]);

  useEffect(() => {
    if (previousProjectIdRef.current === projectId) {
      return;
    }

    previousProjectIdRef.current = projectId;
    dashboardsRequestVersionRef.current += 1;
    dashboardsLoadedRef.current = false;
    dashboardsRequestRef.current = null;
    setIsDashboardsLoading(false);
    setDashboards([]);
    setDashboardsError(null);
    resetWidgetStates();
  }, [projectId, resetWidgetStates]);

  useEffect(() => {
    if (previousResetKeyRef.current === resetKey) {
      return;
    }

    previousResetKeyRef.current = resetKey;
    resetWidgetStates();
  }, [resetKey, resetWidgetStates]);

  const getWidgetState = useCallback(
    (blockKey: string): MessageWidgetAddState =>
      widgetStates.get(blockKey) ?? "idle",
    [widgetStates],
  );

  const setWidgetState = useCallback(
    (blockKey: string, state: MessageWidgetAddState) => {
      setWidgetStates((current) => {
        const next = new Map(current);
        next.set(blockKey, state);
        widgetStatesRef.current = next;
        return next;
      });
    },
    [],
  );

  const clearWidgetState = useCallback(
    (blockKey: string) => {
      setWidgetStates((current) => {
        if (!current.has(blockKey)) {
          return current;
        }

        const next = new Map(current);
        next.delete(blockKey);
        widgetStatesRef.current = next;
        return next;
      });
    },
    [],
  );

  const scheduleAddedState = useCallback(
    (blockKey: string) => {
      clearAddWidgetTimeout(blockKey);
      widgetStateTimeoutsRef.current.set(
        blockKey,
        setTimeout(() => {
          setWidgetStates((current) => {
            if (!current.has(blockKey)) {
              return current;
            }

            const next = new Map(current);
            next.set(blockKey, "added");
            widgetStatesRef.current = next;
            return next;
          });
          widgetStateTimeoutsRef.current.delete(blockKey);
        }, ADD_WIDGET_SUCCESS_DURATION_MS),
      );
    },
    [clearAddWidgetTimeout],
  );

  const fetchDashboards = useCallback(async () => {
    if (dashboardsLoadedRef.current) {
      return;
    }

    if (dashboardsRequestRef.current) {
      return dashboardsRequestRef.current;
    }

    const request = (async () => {
      const requestVersion = dashboardsRequestVersionRef.current;
      setIsDashboardsLoading(true);
      setDashboardsError(null);

      try {
        const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
        const response = await fetch(`/api/custom-dashboards${query}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | ApiErrorPayload
          | unknown;

        if (!response.ok) {
          throw new Error(
            isApiErrorPayload(payload)
              ? payload.error
              : "Failed to load dashboards",
          );
        }

        if (dashboardsRequestVersionRef.current !== requestVersion) {
          return;
        }

        setDashboards(parseDashboards(payload));
        dashboardsLoadedRef.current = true;
      } catch (error) {
        if (dashboardsRequestVersionRef.current !== requestVersion) {
          return;
        }

        setDashboards([]);
        setDashboardsError(toErrorMessage(error));
      } finally {
        if (dashboardsRequestVersionRef.current === requestVersion) {
          setIsDashboardsLoading(false);
          dashboardsRequestRef.current = null;
        }
      }
    })();

    dashboardsRequestRef.current = request;
    return request;
  }, [projectId]);

  const addToDashboard = useCallback(
    async (widget: MessageWidgetAddRequest, dashboardId: string) => {
      const normalizedDashboardId = dashboardId.trim();

      if (!normalizedDashboardId) {
        throw new Error("Please choose a dashboard");
      }

      if (widgetStatesRef.current.get(widget.blockKey) !== undefined) {
        return;
      }

      clearAddWidgetTimeout(widget.blockKey);
      setWidgetState(widget.blockKey, "loading");

      try {
        const response = await fetch(
          `/api/custom-dashboards/${normalizedDashboardId}/widgets`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(buildCreateDashboardWidgetRequest(widget)),
          },
        );
        const payload = (await response.json().catch(() => null)) as
          | ApiErrorPayload
          | unknown;

        if (!response.ok) {
          throw new Error(
            isApiErrorPayload(payload)
              ? payload.error
              : "Failed to add widget",
          );
        }

        setWidgetState(widget.blockKey, "success");
        setDashboards((current) =>
          current.map((dashboard) =>
            dashboard.id === normalizedDashboardId
              ? {
                  ...dashboard,
                  widgetCount: dashboard.widgetCount + 1,
                }
              : dashboard,
          ),
        );
        scheduleAddedState(widget.blockKey);
      } catch (error) {
        clearAddWidgetTimeout(widget.blockKey);
        clearWidgetState(widget.blockKey);
        throw new Error(toErrorMessage(error));
      }
    },
    [
      clearAddWidgetTimeout,
      clearWidgetState,
      scheduleAddedState,
      setWidgetState,
    ],
  );

  return {
    dashboards,
    dashboardsError,
    isDashboardsLoading,
    fetchDashboards,
    addToDashboard,
    getWidgetState,
  };
}
