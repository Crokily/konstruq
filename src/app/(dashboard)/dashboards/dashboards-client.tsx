"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  FolderKanban,
  LayoutGrid,
  Loader2,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DashboardItem {
  id: string;
  name: string;
  description: string | null;
  projectId: string;
  projectName: string;
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

function sortDashboards(items: DashboardItem[]): DashboardItem[] {
  return [...items].sort((a, b) => {
    const aDate = new Date(a.updatedAt).getTime();
    const bDate = new Date(b.updatedAt).getTime();
    return bDate - aDate;
  });
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

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function parseDashboardItem(item: unknown): DashboardItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const rawItem = item as Record<string, unknown>;

  if (
    typeof rawItem.id !== "string" ||
    typeof rawItem.name !== "string" ||
    typeof rawItem.projectId !== "string"
  ) {
    return null;
  }

  return {
    id: rawItem.id,
    name: rawItem.name,
    description:
      typeof rawItem.description === "string" ? rawItem.description : null,
    projectId: rawItem.projectId,
    projectName:
      typeof rawItem.projectName === "string" && rawItem.projectName.trim().length > 0
        ? rawItem.projectName
        : "Unknown project",
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

export function DashboardsClient() {
  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadDashboards() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/custom-dashboards", {
          cache: "no-store",
        });
        const payload = (await response
          .json()
          .catch(() => null)) as DashboardItem[] | ApiError | null;

        if (!response.ok) {
          throw new Error((payload as ApiError | null)?.error ?? "Failed to load dashboards");
        }

        if (!Array.isArray(payload)) {
          throw new Error("Unexpected dashboards response");
        }

        const parsedDashboards = payload
          .map(parseDashboardItem)
          .filter((item): item is DashboardItem => item !== null);

        if (!isCancelled) {
          setDashboards(sortDashboards(parsedDashboards));
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
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portfolio"
        title="My Dashboards"
        description="Review every custom dashboard you have created across your projects."
      />

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {loading ? (
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
            <span>Loading dashboards...</span>
          </CardContent>
        </Card>
      ) : dashboards.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <LayoutGrid className="h-7 w-7 text-amber-500" />
            <p className="max-w-md text-sm text-muted-foreground">
              Create your first dashboard from a Project page.
            </p>
            <Button asChild variant="outline">
              <Link href="/projects">View Projects</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboards.map((dashboard) => (
            <Link
              key={dashboard.id}
              href={`/projects/${dashboard.projectId}/dashboards/${dashboard.id}`}
              className="block"
            >
              <Card className="h-full border-border bg-card transition-colors hover:border-amber-500/40">
                <CardHeader className="space-y-3 pb-2">
                  <CardTitle className="truncate text-base">{dashboard.name}</CardTitle>
                  <CardDescription className="line-clamp-2 min-h-10 text-sm leading-relaxed">
                    {descriptionSnippet(dashboard.description)}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="h-3.5 w-3.5 text-amber-500" />
                    <span>{dashboard.projectName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-3.5 w-3.5 text-amber-500" />
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
    </div>
  );
}
