import { mistral } from "@ai-sdk/mistral";
import { auth } from "@clerk/nextjs/server";
import { streamText, type CoreMessage } from "ai";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { uploadedDatasets, users } from "@/lib/db/schema";
import { normalizeSheets, type DatasetContextItem } from "@/lib/chat/server/dataset-context";
import { budgetMessages, latestUserTextMessage } from "@/lib/chat/server/message-budget";
import { buildSystemPrompt } from "@/lib/chat/server/prompt-builder";

async function resolveAppUserId(clerkId: string): Promise<string | null> {
  let [appUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!appUser) {
    [appUser] = await db
      .insert(users)
      .values({ clerkId, email: "unknown@konstruq.app" })
      .returning({ id: users.id });
  }

  return appUser?.id ?? null;
}

async function loadDatasetContext(userId: string): Promise<DatasetContextItem[]> {
  const datasets = await db
    .select({
      id: uploadedDatasets.id,
      category: uploadedDatasets.category,
      fileName: uploadedDatasets.fileName,
      sheets: uploadedDatasets.sheets,
    })
    .from(uploadedDatasets)
    .where(and(eq(uploadedDatasets.userId, userId), eq(uploadedDatasets.isActive, true)));

  return datasets.map((dataset) => ({
    id: dataset.id,
    category: dataset.category,
    fileName: dataset.fileName,
    sheets: normalizeSheets(dataset.sheets),
  }));
}

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = await resolveAppUserId(clerkUserId);
    if (!userId) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 });
    }

    const datasetContext = await loadDatasetContext(userId);
    const body = (await request.json()) as { messages?: CoreMessage[] };
    const rawMessages = Array.isArray(body.messages) ? (body.messages as CoreMessage[]) : [];
    const messages = budgetMessages(rawMessages);
    const question = latestUserTextMessage(messages);

    const result = streamText({
      model: mistral("mistral-large-latest"),
      system: buildSystemPrompt(datasetContext, question),
      messages,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat route failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to process chat request right now" },
      { status: 500 },
    );
  }
}
