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

export type DatasetCategory = "pm" | "erp" | "uploaded";

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

interface UploadStatus {
  type: StatusType;
  message: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const DEFAULT_DATASET_CATEGORY: DatasetCategory = "uploaded";
const initialStatus: UploadStatus = { type: "idle", message: "" };

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
  const [uploading, setUploading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [status, setStatus] = useState<UploadStatus>(initialStatus);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    setStatus(initialStatus);

    try {
      const formData = new FormData();
      formData.append("file", file);

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

      const nextDataset: DatasetItem = {
        id: payload.id,
        category:
          typeof payload.category === "string"
            ? normalizeCategory(payload.category)
            : DEFAULT_DATASET_CATEGORY,
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

      setStatus({
        type: "success",
        message: `${nextDataset.fileName} uploaded successfully.`,
      });
    } catch (error) {
      setStatus({ type: "error", message: errorMessage(error) });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(dataset: DatasetItem) {
    setDeletingIds((prev) => (prev.includes(dataset.id) ? prev : [...prev, dataset.id]));
    setStatus(initialStatus);

    try {
      const response = await fetch(`/api/upload/${dataset.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as DeleteResponse | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to delete dataset");
      }

      setDatasets((prev) => prev.filter((item) => item.id !== dataset.id));
      setStatus({
        type: "success",
        message: `${dataset.fileName} deleted.`,
      });
    } catch (error) {
      setStatus({ type: "error", message: errorMessage(error) });
    } finally {
      setDeletingIds((prev) => prev.filter((id) => id !== dataset.id));
    }
  }

  function openFilePicker() {
    if (uploading) {
      return;
    }

    fileInputRef.current?.click();
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";

    if (!file) {
      return;
    }

    await uploadFile(file);
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle>Uploaded Files</CardTitle>
        <CardDescription>
          Upload CSV or Excel datasets to use in analysis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 transition-colors hover:border-muted-foreground/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Upload your data files
              </p>
              <p className="text-xs text-muted-foreground">
                Accepted formats: .csv, .xlsx, .xls
              </p>
            </div>
            <Button
              type="button"
              onClick={openFilePicker}
              disabled={uploading}
              className="bg-amber-500 text-amber-950 hover:bg-amber-400"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Uploading..." : "Upload File"}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={onFileChange}
          />
        </div>

        {status.type !== "idle" ? (
          <p
            className={
              status.type === "error"
                ? "text-sm text-red-400"
                : "text-sm text-emerald-400"
            }
          >
            {status.message}
          </p>
        ) : null}

        <div className="space-y-3">
          {datasets.length === 0 ? (
            <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              No files uploaded yet.
            </p>
          ) : (
            datasets.map((dataset) => {
              const isDeleting = deletingIds.includes(dataset.id);

              return (
                <div
                  key={dataset.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-amber-500" />
                      <p className="truncate text-sm font-medium text-foreground">
                        {dataset.fileName}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
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
  );
}
