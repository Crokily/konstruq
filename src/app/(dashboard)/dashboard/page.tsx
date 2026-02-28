import { currentUser } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { DashboardWorkspace, type DatasetCategory, type DatasetSheetRef, type UploadedDatasetRef } from "@/components/dashboard/dashboard-workspace";
import { db } from "@/lib/db";
import { uploadedDatasets, users } from "@/lib/db/schema";
import { MockDataProvider } from "@/lib/data";

function normalizeCategory(value: string): DatasetCategory | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "pm" || normalized === "erp") {
    return normalized;
  }

  return null;
}

function normalizeSheets(value: unknown): DatasetSheetRef[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((sheet): DatasetSheetRef | null => {
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
    .filter((sheet): sheet is DatasetSheetRef => sheet !== null);
}

function normalizeSheetsFromMeta(value: unknown): DatasetSheetRef[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const rawMeta = value as Record<string, unknown>;
  return normalizeSheets(rawMeta.sheets);
}

function toIsoDate(value: Date | string): string {
  const parsedDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return new Date().toISOString();
  }

  return parsedDate.toISOString();
}

export default async function DashboardPage() {
  const user = await currentUser();
  const dataProvider = new MockDataProvider();

  const [kpis, projects, revenueExpenseTrend, projectHealthMatrix] = await Promise.all([
    dataProvider.getPortfolioKPIs(),
    dataProvider.getProjects(),
    dataProvider.getRevenueExpenseTrend(),
    dataProvider.getProjectHealthMatrix(),
  ]);

  let datasetReferences: UploadedDatasetRef[] = [];

  if (user?.id) {
    const [appUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, user.id))
      .limit(1);

    if (appUser) {
      const rows = await db
        .select({
          id: uploadedDatasets.id,
          category: uploadedDatasets.category,
          fileName: uploadedDatasets.fileName,
          meta: uploadedDatasets.meta,
          uploadedAt: uploadedDatasets.uploadedAt,
        })
        .from(uploadedDatasets)
        .where(
          and(
            eq(uploadedDatasets.userId, appUser.id),
            eq(uploadedDatasets.isActive, true)
          )
        )
        .orderBy(desc(uploadedDatasets.uploadedAt))
        .limit(24);

      datasetReferences = rows
        .flatMap((row) => {
          const category = normalizeCategory(row.category);

          if (!category) {
            return [];
          }

          return [
            {
              id: row.id,
              category,
              fileName: row.fileName,
              sheets: normalizeSheetsFromMeta(row.meta),
              uploadedAt: toIsoDate(row.uploadedAt),
            } satisfies UploadedDatasetRef,
          ];
        })
        .sort((a, b) => {
          const aDate = new Date(a.uploadedAt).getTime();
          const bDate = new Date(b.uploadedAt).getTime();
          return bDate - aDate;
        });
    }
  }

  return (
    <DashboardWorkspace
      userFirstName={user?.firstName}
      kpis={kpis}
      projects={projects}
      revenueExpenseTrend={revenueExpenseTrend}
      projectHealthMatrix={projectHealthMatrix}
      datasetReferences={datasetReferences}
    />
  );
}
