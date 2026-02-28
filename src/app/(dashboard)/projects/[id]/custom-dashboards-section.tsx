"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Calendar, LayoutDashboard, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CustomDashboardItem {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  widgetCount: number;
}

interface ApiError {
  error?: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function formatUpdatedAt(value: string): string {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Unknown date";
  }

  return dateFormatter.format(parsedDate);
}

function descriptionSnippet(description: string | null): string {
  if (!description || description.trim().length === 0) {
    return "No description provided.";
  }

  const trimmed = description.trim();
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
}

function parseDashboardItem(item: unknown): CustomDashboardItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const rawItem = item as Record<string, unknown>;

  if (typeof rawItem.id !== "string" || typeof rawItem.name !== "string") {
    return null;
  }

  return {
    id: rawItem.id,
    name: rawItem.name,
    description:
      typeof rawItem.description === "string" ? rawItem.description : null,
    updatedAt:
      typeof rawItem.updatedAt === "string"
        ? rawItem.updatedAt
        : new Date().toISOString(),
    widgetCount:
      typeof rawItem.widgetCount === "number" && Number.isFinite(rawItem.widgetCount)
        ? Math.max(0, Math.floor(rawItem.widgetCount))
        : 0,
  };
}

function sortDashboards(items: CustomDashboardItem[]): CustomDashboardItem[] {
  return [...items].sort((a, b) => {
    const aDate = new Date(a.updatedAt).getTime();
    const bDate = new Date(b.updatedAt).getTime();
    return bDate - aDate;
  });
}

async function requestDashboards(projectId: string): Promise<CustomDashboardItem[]> {
  const response = await fetch(
    `/api/custom-dashboards?projectId=${encodeURIComponent(projectId)}`,
    { cache: "no-store" },
  );
  const payload = (await response
    .json()
    .catch(() => null)) as ApiError | unknown[] | null;

  if (!response.ok) {
    throw new Error((payload as ApiError | null)?.error ?? "Failed to load dashboards");
  }

  if (!Array.isArray(payload)) {
    throw new Error("Unexpected dashboards response");
  }

  const parsed = payload
    .map(parseDashboardItem)
    .filter((item): item is CustomDashboardItem => item !== null);

  return sortDashboards(parsed);
}

export function CustomDashboardsSection({ projectId }: { projectId: string }) {
  const [dashboards, setDashboards] = useState<CustomDashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadDashboards() {
      setLoading(true);
      setError("");

      try {
        const loadedDashboards = await requestDashboards(projectId);

        if (!isCancelled) {
          setDashboards(loadedDashboards);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(toErrorMessage(loadError));
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboards();

    return () => {
      isCancelled = true;
    };
  }, [projectId]);

  function openCreateDialog() {
    setCreateError("");
    setDialogOpen(true);
  }

  async function handleCreateDashboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = createName.trim();
    const description = createDescription.trim();

    if (name.length === 0) {
      setCreateError("Dashboard name is required.");
      return;
    }

    setCreating(true);
    setCreateError("");

    try {
      const createResponse = await fetch("/api/custom-dashboards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          name,
          description,
        }),
      });
      const createPayload = (await createResponse
        .json()
        .catch(() => null)) as ApiError | Record<string, unknown> | null;

      if (!createResponse.ok) {
        throw new Error(
          (createPayload as ApiError | null)?.error ?? "Failed to create dashboard",
        );
      }

      const refreshedDashboards = await requestDashboards(projectId);
      setDashboards(refreshedDashboards);
      setCreateName("");
      setCreateDescription("");
      setDialogOpen(false);
      setError("");
    } catch (createDashboardError) {
      setCreateError(toErrorMessage(createDashboardError));
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Custom Dashboards
        </h2>
        <Button
          type="button"
          onClick={openCreateDialog}
          className="bg-amber-500 text-amber-950 hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" />
          Create Dashboard
        </Button>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!creating) {
            setDialogOpen(open);
          }

          if (!open) {
            setCreateError("");
          }
        }}
      >
        <DialogContent className="border-border bg-card">
          <DialogHeader>
            <DialogTitle>Create Dashboard</DialogTitle>
            <DialogDescription>
              Create a custom dashboard for this project.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDashboard} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="custom-dashboard-name"
                className="text-sm font-medium text-foreground"
              >
                Name
              </label>
              <input
                id="custom-dashboard-name"
                required
                value={createName}
                onChange={(event) => setCreateName(event.currentTarget.value)}
                placeholder="Dashboard name"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-amber-500"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="custom-dashboard-description"
                className="text-sm font-medium text-foreground"
              >
                Description
              </label>
              <textarea
                id="custom-dashboard-description"
                value={createDescription}
                onChange={(event) => setCreateDescription(event.currentTarget.value)}
                placeholder="Brief description (optional)"
                className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-amber-500"
              />
            </div>

            {createError ? <p className="text-sm text-red-400">{createError}</p> : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-amber-500 text-amber-950 hover:bg-amber-400"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {creating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {loading ? (
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
            <span>Loading custom dashboards...</span>
          </CardContent>
        </Card>
      ) : dashboards.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <LayoutDashboard className="h-7 w-7 text-amber-500" />
            <p className="max-w-md text-sm text-muted-foreground">
              No custom dashboards yet. Create your first dashboard to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((dashboard) => (
            <Link
              key={dashboard.id}
              href={`/projects/${projectId}/dashboards/${dashboard.id}`}
              className="block"
            >
              <Card className="border-border bg-card h-full transition-colors hover:border-amber-500/40">
                <CardHeader className="space-y-3 pb-2">
                  <CardTitle className="truncate text-base">{dashboard.name}</CardTitle>
                  <CardDescription className="line-clamp-2 min-h-10 text-sm leading-relaxed">
                    {descriptionSnippet(dashboard.description)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-3.5 w-3.5 text-amber-500" />
                    <span>
                      {dashboard.widgetCount.toLocaleString()}{" "}
                      {dashboard.widgetCount === 1 ? "widget" : "widgets"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-amber-500" />
                    <span>Updated {formatUpdatedAt(dashboard.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
