"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Calendar,
  FileSpreadsheet,
  FolderKanban,
  Plus,
  Trash2,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

interface ProjectItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  datasetCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiError {
  error?: string;
}

interface CreateProjectResponse {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function sortProjects(items: ProjectItem[]): ProjectItem[] {
  return [...items].sort((a, b) => {
    const aDate = new Date(a.updatedAt).getTime();
    const bDate = new Date(b.updatedAt).getTime();
    return bDate - aDate;
  });
}

function formatCreatedAt(value: string): string {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Unknown date";
  }

  return dateFormatter.format(parsedDate);
}

function formatStatus(status: string): string {
  return status
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isActiveStatus(status: string): boolean {
  return status.trim().toLowerCase() === "active";
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

export function ProjectsClient() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadProjects() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/projects");
        const payload = (await response
          .json()
          .catch(() => null)) as ProjectItem[] | ApiError | null;

        if (!response.ok) {
          throw new Error((payload as ApiError | null)?.error ?? "Failed to load projects");
        }

        if (!Array.isArray(payload)) {
          throw new Error("Unexpected projects response");
        }

        if (!isCancelled) {
          setProjects(sortProjects(payload));
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

    void loadProjects();

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleDeleteProject(project: ProjectItem) {
    setDeletingIds((prev) => (prev.includes(project.id) ? prev : [...prev, project.id]));
    setError("");

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      const payload = (await response
        .json()
        .catch(() => null)) as ApiError | { success?: boolean } | null;

      if (!response.ok) {
        throw new Error((payload as ApiError | null)?.error ?? "Failed to delete project");
      }

      setProjects((prev) => prev.filter((item) => item.id !== project.id));
    } catch (deleteError) {
      setError(toErrorMessage(deleteError));
    } finally {
      setDeletingIds((prev) => prev.filter((id) => id !== project.id));
    }
  }

  function openCreateDialog() {
    setCreateError("");
    setDialogOpen(true);
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = createName.trim();
    const description = createDescription.trim();

    if (name.length === 0) {
      setCreateError("Project name is required.");
      return;
    }

    setCreating(true);
    setCreateError("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, description }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as CreateProjectResponse | ApiError | null;

      if (!response.ok) {
        throw new Error((payload as ApiError | null)?.error ?? "Failed to create project");
      }

      const created = payload as CreateProjectResponse | null;

      if (!created || typeof created.id !== "string" || typeof created.name !== "string") {
        throw new Error("Unexpected create project response");
      }

      const createdAt =
        typeof created.createdAt === "string"
          ? created.createdAt
          : new Date().toISOString();
      const updatedAt =
        typeof created.updatedAt === "string" ? created.updatedAt : createdAt;

      const createdProject: ProjectItem = {
        id: created.id,
        name: created.name,
        description: typeof created.description === "string" ? created.description : null,
        status: typeof created.status === "string" ? created.status : "active",
        datasetCount: 0,
        createdAt,
        updatedAt,
      };

      setProjects((prev) =>
        sortProjects([
          createdProject,
          ...prev.filter((project) => project.id !== createdProject.id),
        ]),
      );
      setCreateName("");
      setCreateDescription("");
      setDialogOpen(false);
      setError("");
    } catch (createProjectError) {
      setCreateError(toErrorMessage(createProjectError));
    } finally {
      setCreating(false);
    }
  }

  const createButton = (
    <Button
      type="button"
      onClick={openCreateDialog}
      className="bg-amber-500 text-amber-950 hover:bg-amber-400"
    >
      <Plus className="h-4 w-4" />
      Create Project
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portfolio"
        title="Projects"
        description="Create and manage your construction projects."
        actions={createButton}
      />

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
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>
              Start a new project to organize your schedules, budgets, and datasets.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateProject} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="project-name" className="text-sm font-medium text-foreground">
                Name
              </label>
              <input
                id="project-name"
                required
                value={createName}
                onChange={(event) => setCreateName(event.currentTarget.value)}
                placeholder="Project name"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-amber-500"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="project-description"
                className="text-sm font-medium text-foreground"
              >
                Description
              </label>
              <textarea
                id="project-description"
                value={createDescription}
                onChange={(event) => setCreateDescription(event.currentTarget.value)}
                placeholder="Brief description"
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
                <Plus className="h-4 w-4" />
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
            <FolderKanban className="h-5 w-5 text-amber-500" />
            <span>Loading projects...</span>
          </CardContent>
        </Card>
      ) : projects.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <FolderKanban className="h-7 w-7 text-amber-500" />
            <p className="max-w-md text-sm text-muted-foreground">
              No projects yet. Create your first project to get started.
            </p>
            <Button
              type="button"
              onClick={openCreateDialog}
              className="bg-amber-500 text-amber-950 hover:bg-amber-400"
            >
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const isDeleting = deletingIds.includes(project.id);
            const active = isActiveStatus(project.status);

            return (
              <div key={project.id} className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    void handleDeleteProject(project);
                  }}
                  disabled={isDeleting}
                  className="text-red-400 hover:bg-red-500/10 hover:text-red-300 absolute top-4 right-4 z-10"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">
                    {isDeleting ? "Deleting project" : "Delete project"}
                  </span>
                </Button>

                <Link href={`/projects/${project.id}`} className="block">
                  <Card className="border-border bg-card h-full transition-colors hover:border-amber-500/40">
                    <CardHeader className="space-y-3 pb-2">
                      <div className="flex items-start justify-between gap-2 pr-10">
                        <CardTitle className="truncate text-base">{project.name}</CardTitle>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11px] uppercase tracking-wide",
                            active
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                              : "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          {formatStatus(project.status)}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2 min-h-10 text-sm leading-relaxed">
                        {descriptionSnippet(project.description)}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-amber-500" />
                        <span>
                          {project.datasetCount.toLocaleString()}{" "}
                          {project.datasetCount === 1 ? "dataset" : "datasets"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-amber-500" />
                        <span>Created {formatCreatedAt(project.createdAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
