import { tool } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { uploadedDatasets } from "@/lib/db/schema";

import {
  applyRowFilter,
  findSheet,
  inferValueType,
  normalizeSheets,
  projectRowsToColumns,
} from "./dataset-utils";
import type { DatasetRow, RowFilter } from "./types";

const rowFilterSchema = z.object({
  column: z.string(),
  operator: z.enum(["equals", "contains", "gt", "lt", "gte", "lte"]),
  value: z.union([z.string(), z.number()]),
});

type ToolRowFilter = z.infer<typeof rowFilterSchema>;

function buildDatasetFilter(appUserId: string, projectId?: string) {
  const conditions = [
    eq(uploadedDatasets.userId, appUserId),
    eq(uploadedDatasets.isActive, true),
  ];
  if (projectId) {
    conditions.push(eq(uploadedDatasets.projectId, projectId));
  }
  return and(...conditions);
}

async function fetchDatasetSheets(
  appUserId: string,
  projectId: string | undefined,
  datasetId: string,
) {
  const conditions = [
    eq(uploadedDatasets.id, datasetId),
    eq(uploadedDatasets.userId, appUserId),
    eq(uploadedDatasets.isActive, true),
  ];
  if (projectId) {
    conditions.push(eq(uploadedDatasets.projectId, projectId));
  }

  const [dataset] = await db
    .select({ sheets: uploadedDatasets.sheets })
    .from(uploadedDatasets)
    .where(and(...conditions))
    .limit(1);

  if (!dataset) {
    return null;
  }

  return normalizeSheets(dataset.sheets);
}

function getSheetNotFoundError(sheetName?: string) {
  return {
    error: sheetName ? `Sheet "${sheetName}" not found` : "No sheets found in dataset",
  };
}

function castRowFilter(filter?: ToolRowFilter): RowFilter | undefined {
  if (!filter) {
    return undefined;
  }

  return filter;
}

export function createDataTools(appUserId: string, projectId?: string) {
  return {
    listDatasets: tool({
      description:
        "List all datasets the user has uploaded. Returns dataset IDs, file names, categories, and per-sheet schema (column names, row counts). Call this first to understand what data is available.",
      parameters: z.object({}),
      execute: async () => {
        const datasets = await db
          .select({
            id: uploadedDatasets.id,
            fileName: uploadedDatasets.fileName,
            category: uploadedDatasets.category,
            sheets: uploadedDatasets.sheets,
          })
          .from(uploadedDatasets)
          .where(buildDatasetFilter(appUserId, projectId))
          .orderBy(desc(uploadedDatasets.uploadedAt));

        return datasets.map((dataset) => {
          const sheets = normalizeSheets(dataset.sheets);

          return {
            datasetId: dataset.id,
            fileName: dataset.fileName,
            category: dataset.category,
            sheets: sheets.map((sheet) => ({
              sheetName: sheet.sheetName,
              columns: sheet.columns,
              rowCount: sheet.rowCount,
            })),
          };
        });
      },
    }),

    getDatasetSchema: tool({
      description:
        "Get detailed schema for a specific dataset: column names, data types (inferred from first row), and sample values.",
      parameters: z.object({
        datasetId: z.string().uuid().describe("The UUID of the dataset"),
      }),
      execute: async ({ datasetId }) => {
        const sheets = await fetchDatasetSheets(appUserId, projectId, datasetId);

        if (!sheets) {
          return { error: "Dataset not found or access denied" };
        }

        return sheets.map((sheet) => {
          const sampleRow = sheet.rows[0] ?? {};

          return {
            sheetName: sheet.sheetName,
            rowCount: sheet.rowCount,
            columns: sheet.columns.map((column) => ({
              name: column,
              sampleValue: sampleRow[column] ?? null,
              inferredType: inferValueType(sampleRow[column]),
            })),
          };
        });
      },
    }),

    queryDatasetRows: tool({
      description:
        "Fetch rows from a dataset sheet. Supports filtering by column value, pagination (offset/limit), and column selection. Default limit 50, max 200.",
      parameters: z.object({
        datasetId: z.string().uuid(),
        sheetName: z.string().optional().describe("Defaults to first sheet"),
        columns: z
          .array(z.string())
          .optional()
          .describe("Columns to return; omit for all"),
        filter: rowFilterSchema.optional(),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(200).default(50),
      }),
      execute: async ({ datasetId, sheetName, columns, filter, offset, limit }) => {
        const sheets = await fetchDatasetSheets(appUserId, projectId, datasetId);

        if (!sheets) {
          return { error: "Dataset not found" };
        }

        const targetSheet = findSheet(sheets, sheetName);

        if (!targetSheet) {
          return getSheetNotFoundError(sheetName);
        }

        const filteredRows = applyRowFilter(targetSheet.rows, castRowFilter(filter));
        const pagedRows = filteredRows.slice(offset, offset + limit);
        const projectedRows = projectRowsToColumns(pagedRows, columns);

        return {
          sheetName: targetSheet.sheetName,
          totalRows: targetSheet.rowCount,
          matchingRows: filteredRows.length,
          returnedRows: projectedRows.length,
          offset,
          rows: projectedRows,
        };
      },
    }),

    searchDatasets: tool({
      description:
        "Search across ALL datasets for rows containing a value in any column. Useful when user mentions a project name, vendor, cost code, etc. Returns up to 20 matches per dataset. Optional category filter: pm, erp, uploaded.",
      parameters: z.object({
        searchTerm: z.string().describe("Case-insensitive partial match"),
        category: z.enum(["pm", "erp", "uploaded"]).optional(),
      }),
      execute: async ({ searchTerm, category }) => {
        const datasetFilter = buildDatasetFilter(appUserId, projectId);

        const datasets = await db
          .select({
            id: uploadedDatasets.id,
            fileName: uploadedDatasets.fileName,
            category: uploadedDatasets.category,
            sheets: uploadedDatasets.sheets,
          })
          .from(uploadedDatasets)
          .where(
            category
              ? and(datasetFilter, eq(uploadedDatasets.category, category))
              : datasetFilter,
          );

        const query = searchTerm.toLowerCase();
        const results: Array<{
          datasetId: string;
          fileName: string;
          category: string;
          sheetName: string;
          matchingRows: DatasetRow[];
          totalMatches: number;
        }> = [];

        for (const dataset of datasets) {
          const sheets = normalizeSheets(dataset.sheets);

          for (const sheet of sheets) {
            const matches = sheet.rows.filter((row) =>
              Object.values(row).some((value) =>
                String(value ?? "").toLowerCase().includes(query),
              ),
            );

            if (matches.length === 0) {
              continue;
            }

            results.push({
              datasetId: dataset.id,
              fileName: dataset.fileName,
              category: dataset.category,
              sheetName: sheet.sheetName,
              matchingRows: matches.slice(0, 20),
              totalMatches: matches.length,
            });
          }
        }

        return {
          searchTerm,
          totalDatasetsSearched: datasets.length,
          results,
        };
      },
    }),

    aggregateColumn: tool({
      description:
        "Compute aggregate stats (sum, average, min, max, count, distinct) for a numeric column. Supports optional pre-filter. Use this for summary calculations instead of fetching all rows.",
      parameters: z.object({
        datasetId: z.string().uuid(),
        sheetName: z.string().optional(),
        column: z.string(),
        operation: z.enum(["sum", "average", "min", "max", "count", "distinct"]),
        filter: rowFilterSchema.optional(),
      }),
      execute: async ({ datasetId, sheetName, column, operation, filter }) => {
        const sheets = await fetchDatasetSheets(appUserId, projectId, datasetId);

        if (!sheets) {
          return { error: "Dataset not found" };
        }

        const targetSheet = findSheet(sheets, sheetName);

        if (!targetSheet) {
          return getSheetNotFoundError(sheetName);
        }

        const filteredRows = applyRowFilter(targetSheet.rows, castRowFilter(filter));
        const values = filteredRows
          .map((row) => row[column])
          .filter((value) => value !== null && value !== undefined);
        const numericValues = values
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value));

        switch (operation) {
          case "sum":
            return {
              column,
              operation,
              result: numericValues.reduce((sum, value) => sum + value, 0),
              count: numericValues.length,
            };
          case "average":
            return {
              column,
              operation,
              result:
                numericValues.length > 0
                  ? numericValues.reduce((sum, value) => sum + value, 0) /
                    numericValues.length
                  : 0,
              count: numericValues.length,
            };
          case "min":
            return {
              column,
              operation,
              result: numericValues.length > 0 ? Math.min(...numericValues) : null,
              count: numericValues.length,
            };
          case "max":
            return {
              column,
              operation,
              result: numericValues.length > 0 ? Math.max(...numericValues) : null,
              count: numericValues.length,
            };
          case "count":
            return {
              column,
              operation,
              result: values.length,
            };
          case "distinct": {
            const distinctValues = [...new Set(values.map((value) => String(value)))];

            return {
              column,
              operation,
              values: distinctValues,
              count: distinctValues.length,
            };
          }
          default:
            return { error: "Unsupported aggregation operation" };
        }
      },
    }),
  };
}
