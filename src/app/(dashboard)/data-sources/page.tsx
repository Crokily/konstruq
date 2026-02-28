import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { uploadedDatasets, users } from "@/lib/db/schema";

import {
  DataSourcesClient,
  type DatasetCategory,
  type DatasetItem,
  type DatasetSheet,
} from "./data-sources-client";

function normalizeCategory(value: string): DatasetCategory | null {
  const normalized = value.trim().toLowerCase();

  if (normalized === "pm" || normalized === "erp") {
    return normalized;
  }

  return null;
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
      const datasets = await db
        .select({
          id: uploadedDatasets.id,
          category: uploadedDatasets.category,
          fileName: uploadedDatasets.fileName,
          sheets: uploadedDatasets.sheets,
          uploadedAt: uploadedDatasets.uploadedAt,
        })
        .from(uploadedDatasets)
        .where(eq(uploadedDatasets.userId, appUser.id));

      initialDatasets = sortDatasets(
        datasets.flatMap((dataset) => {
          const category = normalizeCategory(dataset.category);

          if (!category) {
            return [];
          }

          return [
            {
              id: dataset.id,
              category,
              fileName: dataset.fileName,
              sheets: normalizeSheets(dataset.sheets),
              uploadedAt: toIsoDate(dataset.uploadedAt),
            } satisfies DatasetItem,
          ];
        }),
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
      <DataSourcesClient initialDatasets={initialDatasets} />
    </div>
  );
}
