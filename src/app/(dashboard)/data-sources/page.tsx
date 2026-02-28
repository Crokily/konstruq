import { auth } from "@clerk/nextjs/server";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { projects, uploadedDatasets, users } from "@/lib/db/schema";

import {
  DataSourcesClient,
  type DatasetCategory,
  type DatasetItem,
  type DatasetSheet,
  type ProjectOption,
} from "./data-sources-client";

const DEFAULT_DATASET_CATEGORY: DatasetCategory = "uploaded";

function normalizeCategory(value: string): DatasetCategory {
  const normalized = value.trim().toLowerCase();

  if (
    normalized === "pm" ||
    normalized === "erp" ||
    normalized === DEFAULT_DATASET_CATEGORY
  ) {
    return normalized;
  }

  return DEFAULT_DATASET_CATEGORY;
}

function normalizeSheets(value: unknown): DatasetSheet[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((sheet): DatasetSheet | null => {
      if (!sheet || typeof sheet !== "object") {
        return null;
      }

      const rawSheet = sheet as Record<string, unknown>;
      const parsedRowCount = Number(rawSheet.rowCount);

      return {
        sheetName:
          typeof rawSheet.sheetName === "string" && rawSheet.sheetName.length > 0
            ? rawSheet.sheetName
            : "Sheet",
        columns: Array.isArray(rawSheet.columns)
          ? rawSheet.columns.filter((column): column is string => typeof column === "string")
          : [],
        rowCount: Number.isFinite(parsedRowCount) ? Math.max(0, parsedRowCount) : 0,
      };
    })
    .filter((sheet): sheet is DatasetSheet => sheet !== null);
}

function toIsoDate(value: Date | string): string {
  const parsedDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return new Date().toISOString();
  }

  return parsedDate.toISOString();
}

function sortDatasets(items: DatasetItem[]): DatasetItem[] {
  return [...items].sort((a, b) => {
    const aDate = new Date(a.uploadedAt).getTime();
    const bDate = new Date(b.uploadedAt).getTime();
    return bDate - aDate;
  });
}

export default async function DataSourcesPage() {
  const { userId } = await auth();

  let initialDatasets: DatasetItem[] = [];
  let projectOptions: ProjectOption[] = [];

  if (userId) {
    let [appUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (!appUser) {
      [appUser] = await db
        .insert(users)
        .values({ clerkId: userId, email: "unknown@konstruq.app" })
        .returning({ id: users.id });
    }

    if (appUser) {
      const [allProjects, activeProjects, datasets] = await Promise.all([
        db
          .select({
            id: projects.id,
            name: projects.name,
          })
          .from(projects)
          .where(eq(projects.userId, appUser.id)),
        db
          .select({
            id: projects.id,
            name: projects.name,
          })
          .from(projects)
          .where(
            and(
              eq(projects.userId, appUser.id),
              ne(projects.status, "archived"),
            ),
          ),
        db
          .select({
            id: uploadedDatasets.id,
            category: uploadedDatasets.category,
            fileName: uploadedDatasets.fileName,
            sheets: uploadedDatasets.sheets,
            uploadedAt: uploadedDatasets.uploadedAt,
            projectId: uploadedDatasets.projectId,
          })
          .from(uploadedDatasets)
          .where(eq(uploadedDatasets.userId, appUser.id)),
      ]);

      const projectNameById = new Map(
        allProjects.map((project) => [project.id, project.name]),
      );

      projectOptions = activeProjects.map((project) => ({
        id: project.id,
        name: project.name,
      }));

      initialDatasets = sortDatasets(
        datasets.map(
          (dataset) =>
            ({
              id: dataset.id,
              category: normalizeCategory(dataset.category),
              fileName: dataset.fileName,
              sheets: normalizeSheets(dataset.sheets),
              uploadedAt: toIsoDate(dataset.uploadedAt),
              projectId: dataset.projectId ?? undefined,
              projectName: dataset.projectId
                ? projectNameById.get(dataset.projectId)
                : undefined,
            }) satisfies DatasetItem,
        ),
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Data Sources</h1>
        <p className="mt-1 text-muted-foreground">
          Upload and manage your project data files
        </p>
      </div>
      <DataSourcesClient
        initialDatasets={initialDatasets}
        projects={projectOptions}
      />
    </div>
  );
}
