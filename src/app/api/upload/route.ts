import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";

import { db } from "@/lib/db";
import { uploadedDatasets, users } from "@/lib/db/schema";

type UploadCategory = "pm" | "erp";

interface ParsedSheet {
  sheetName: string;
  columns: string[];
  rowCount: number;
  rows: Record<string, unknown>[];
}

function normalizeCategory(value: string): UploadCategory | null {
  const normalized = value.trim().toLowerCase();

  if (normalized === "pm" || normalized === "erp") {
    return normalized;
  }

  return null;
}

async function parseSheetsFromFile(file: File): Promise<ParsedSheet[]> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".csv")) {
    const text = new TextDecoder().decode(await file.arrayBuffer());
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (result.errors.length > 0) {
      throw new Error(result.errors[0]?.message ?? "CSV parsing failed");
    }

    return [
      {
        sheetName: file.name,
        columns: result.meta.fields ?? [],
        rowCount: result.data.length,
        rows: result.data,
      },
    ];
  }

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });

    return workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: null,
      });
      const firstRow = headerRows[0];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: null,
      });

      return {
        sheetName,
        columns: Array.isArray(firstRow)
          ? firstRow.map((value) => String(value ?? ""))
          : [],
        rowCount: rows.length,
        rows,
      };
    });
  }

  throw new Error("Unsupported file format. Please upload CSV or XLSX files.");
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    if (!appUser) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 });
    }

    const formData = await request.formData();
    const fileInput = formData.get("file");
    const categoryInput = formData.get("category");

    if (!(fileInput instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (typeof categoryInput !== "string") {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const category = normalizeCategory(categoryInput);

    if (!category) {
      return NextResponse.json(
        { error: "Category must be one of: pm, erp" },
        { status: 400 },
      );
    }

    const fileName = fileInput.name;
    const normalizedFileName = fileName.toLowerCase();
    const isCsv = normalizedFileName.endsWith(".csv");
    const isExcel =
      normalizedFileName.endsWith(".xlsx") ||
      normalizedFileName.endsWith(".xls");

    if (!isCsv && !isExcel) {
      return NextResponse.json(
        { error: "Unsupported format. Only CSV and XLSX/XLS are allowed." },
        { status: 400 },
      );
    }

    let sheets: ParsedSheet[];

    try {
      sheets = await parseSheetsFromFile(fileInput);
    } catch (error) {
      console.error("Failed to parse uploaded file:", error);
      return NextResponse.json(
        { error: "Failed to parse uploaded file" },
        { status: 400 },
      );
    }

    const [createdDataset] = await db
      .insert(uploadedDatasets)
      .values({
        userId: appUser.id,
        category,
        fileName,
        sheets,
      })
      .returning({
        id: uploadedDatasets.id,
      });

    if (!createdDataset) {
      return NextResponse.json({ error: "Failed to store uploaded dataset" }, { status: 500 });
    }

    return NextResponse.json({
      id: createdDataset.id,
      fileName,
      category,
      sheets: sheets.map(({ sheetName, columns, rowCount }) => ({
        sheetName,
        columns,
        rowCount,
      })),
    });
  } catch (error) {
    console.error("Upload route failed:", error);
    return NextResponse.json(
      { error: "Unable to process upload right now" },
      { status: 500 },
    );
  }
}
