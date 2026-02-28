"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type DatasetCategory = "pm" | "erp";

export interface DatasetSheet {
  sheetName: string;
  columns: string[];
  rowCount: number;
}

export interface DatasetItem {
  id: string;
  category: DatasetCategory;
  fileName: string;
  sheets: DatasetSheet[];
  uploadedAt: string;
}

interface DataSourcesClientProps {
  initialDatasets: DatasetItem[];
}

interface UploadResponse {
  id?: string;
  fileName?: string;
  category?: string;
  sheets?: unknown;
  error?: string;
}

interface DeleteResponse {
  success?: boolean;
  error?: string;
}

type StatusType = "idle" | "success" | "error";

interface CategoryStatus {
  type: StatusType;
  message: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const initialStatus: Record<DatasetCategory, CategoryStatus> = {
  pm: { type: "idle", message: "" },
  erp: { type: "idle", message: "" },
};

const sectionContent: Record<
  DatasetCategory,
  { title: string; description: string; emptyMessage: string }
> = {
  pm: {
    title: "PM Data (Project Management)",
    description: "Upload schedule, activity, and project operations datasets.",
    emptyMessage: "No PM files uploaded yet.",
  },
  erp: {
    title: "ERP Data (Financial)",
    description: "Upload accounting, cost, and financial performance datasets.",
    emptyMessage: "No ERP files uploaded yet.",
  },
};

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

function formatUploadedAt(value: string): string {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Unknown date";
  }

  return dateFormatter.format(parsedDate);
}

function totalRows(sheets: DatasetSheet[]): number {
  return sheets.reduce((sum, sheet) => sum + sheet.rowCount, 0);
}

function sortDatasets(items: DatasetItem[]): DatasetItem[] {
  return [...items].sort((a, b) => {
    const aDate = new Date(a.uploadedAt).getTime();
    const bDate = new Date(b.uploadedAt).getTime();
    return bDate - aDate;
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export function DataSourcesClient({ initialDatasets }: DataSourcesClientProps) {
  const [datasets, setDatasets] = useState<DatasetItem[]>(() =>
    sortDatasets(initialDatasets),
  );
  const [uploading, setUploading] = useState<Record<DatasetCategory, boolean>>({
    pm: false,
    erp: false,
  });
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [status, setStatus] = useState<Record<DatasetCategory, CategoryStatus>>(
    initialStatus,
  );

  const pmInputRef = useRef<HTMLInputElement>(null);
  const erpInputRef = useRef<HTMLInputElement>(null);

  const datasetsByCategory: Record<DatasetCategory, DatasetItem[]> = {
    pm: datasets.filter((dataset) => dataset.category === "pm"),
    erp: datasets.filter((dataset) => dataset.category === "erp"),
  };

  async function uploadFile(category: DatasetCategory, file: File) {
    setUploading((prev) => ({ ...prev, [category]: true }));
    setStatus((prev) => ({ ...prev, [category]: { type: "idle", message: "" } }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as UploadResponse | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to upload dataset");
      }

      if (!payload?.id) {
        throw new Error("Upload response did not include dataset id");
      }

      const createdCategory =
        (typeof payload.category === "string" && normalizeCategory(payload.category)) ||
        category;

      const nextDataset: DatasetItem = {
        id: payload.id,
        category: createdCategory,
        fileName: typeof payload.fileName === "string" ? payload.fileName : file.name,
        sheets: normalizeSheets(payload.sheets),
        uploadedAt: new Date().toISOString(),
      };

      setDatasets((prev) =>
        sortDatasets([
          nextDataset,
          ...prev.filter((dataset) => dataset.id !== nextDataset.id),
        ]),
      );

      setStatus((prev) => ({
        ...prev,
        [category]: {
          type: "success",
          message: `${nextDataset.fileName} uploaded successfully.`,
        },
      }));
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        [category]: { type: "error", message: errorMessage(error) },
      }));
    } finally {
      setUploading((prev) => ({ ...prev, [category]: false }));
    }
  }

  async function handleDelete(dataset: DatasetItem) {
    setDeletingIds((prev) => (prev.includes(dataset.id) ? prev : [...prev, dataset.id]));
    setStatus((prev) => ({
      ...prev,
      [dataset.category]: { type: "idle", message: "" },
    }));

    try {
      const response = await fetch(`/api/upload/${dataset.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as DeleteResponse | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to delete dataset");
      }

      setDatasets((prev) => prev.filter((item) => item.id !== dataset.id));
      setStatus((prev) => ({
        ...prev,
        [dataset.category]: {
          type: "success",
          message: `${dataset.fileName} deleted.`,
        },
      }));
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        [dataset.category]: { type: "error", message: errorMessage(error) },
      }));
    } finally {
      setDeletingIds((prev) => prev.filter((id) => id !== dataset.id));
    }
  }

  function openFilePicker(category: DatasetCategory) {
    if (uploading[category]) {
      return;
    }

    const inputRef = category === "pm" ? pmInputRef : erpInputRef;
    inputRef.current?.click();
  }

  async function onFileChange(
    category: DatasetCategory,
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";

    if (!file) {
      return;
    }

    await uploadFile(category, file);
  }

  return (
    <div className="space-y-6">
      {(Object.keys(sectionContent) as DatasetCategory[]).map((category) => (
        <Card key={category} className="border-slate-800 bg-slate-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-100">
              {sectionContent[category].title}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {sectionContent[category].description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4 transition-colors hover:border-slate-600">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    Upload CSV or Excel files
                  </p>
                  <p className="text-xs text-slate-400">
                    Accepted formats: .csv, .xlsx, .xls
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => openFilePicker(category)}
                  disabled={uploading[category]}
                  className="bg-amber-500 text-slate-950 hover:bg-amber-400"
                >
                  {uploading[category] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading[category] ? "Uploading..." : "Upload File"}
                </Button>
              </div>
              <input
                ref={category === "pm" ? pmInputRef : erpInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(event) => onFileChange(category, event)}
              />
            </div>

            {status[category].type !== "idle" ? (
              <p
                className={
                  status[category].type === "error"
                    ? "text-sm text-red-400"
                    : "text-sm text-emerald-400"
                }
              >
                {status[category].message}
              </p>
            ) : null}

            <div className="space-y-3">
              {datasetsByCategory[category].length === 0 ? (
                <p className="rounded-lg bg-slate-800/50 p-4 text-sm text-slate-400">
                  {sectionContent[category].emptyMessage}
                </p>
              ) : (
                datasetsByCategory[category].map((dataset) => {
                  const isDeleting = deletingIds.includes(dataset.id);

                  return (
                    <div
                      key={dataset.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-800/50 p-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-amber-500" />
                          <p className="truncate text-sm font-medium text-slate-100">
                            {dataset.fileName}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span>{dataset.sheets.length} sheets</span>
                          <span>{totalRows(dataset.sheets).toLocaleString()} rows</span>
                          <span>Uploaded {formatUploadedAt(dataset.uploadedAt)}</span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(dataset)}
                        disabled={isDeleting}
                        className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Delete
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
