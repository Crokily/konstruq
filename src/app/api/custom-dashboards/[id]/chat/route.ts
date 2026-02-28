import { mistral } from "@ai-sdk/mistral";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { streamText, type CoreMessage } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { createDataTools } from "@/app/api/chat/_lib/data-tools";
import { trimMessages } from "@/app/api/chat/_lib/history";
import { DASHBOARD_BUILDER_PROMPT } from "@/app/api/custom-dashboards/_lib/builder-prompt";
import { resolveAppUserId } from "@/lib/db/app-user";
import { db } from "@/lib/db";
import { customDashboards } from "@/lib/db/schema";

interface DashboardChatRouteContext {
  params: Promise<{ id: string }>;
}

export const maxDuration = 60;

async function getOwnedDashboard(appUserId: string, dashboardId: string) {
  const [dashboard] = await db
    .select({
      id: customDashboards.id,
      projectId: customDashboards.projectId,
    })
    .from(customDashboards)
    .where(
      and(
        eq(customDashboards.id, dashboardId),
        eq(customDashboards.userId, appUserId),
        eq(customDashboards.status, "active"),
      ),
    )
    .limit(1);

  return dashboard ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: DashboardChatRouteContext,
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUserId = await resolveAppUserId(userId);

    if (!appUserId) {
      return NextResponse.json(
        { error: "Unable to resolve user" },
        { status: 500 },
      );
    }

    if (!process.env.MISTRAL_API_KEY) {
      return NextResponse.json(
        { error: "MISTRAL_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const { id } = await params;
    const dashboardId = id.trim();

    if (!dashboardId) {
      return NextResponse.json(
        { error: "Invalid dashboard id" },
        { status: 400 },
      );
    }

    const dashboard = await getOwnedDashboard(appUserId, dashboardId);

    if (!dashboard) {
      return NextResponse.json(
        { error: "Custom dashboard not found" },
        { status: 404 },
      );
    }

    let body: { messages?: CoreMessage[] };

    try {
      body = (await request.json()) as { messages?: CoreMessage[] };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const incomingMessages = Array.isArray(body.messages)
      ? body.messages
      : [];

    const result = streamText({
      model: mistral("mistral-large-latest"),
      system: DASHBOARD_BUILDER_PROMPT,
      messages: trimMessages(incomingMessages),
      tools: createDataTools(appUserId, dashboard.projectId),
      maxSteps: 8,
      onFinish({ usage }) {
        if (!usage) {
          return;
        }

        console.log(
          `[CustomDashboardChat:${dashboard.id}] tokens: prompt=${usage.promptTokens}, completion=${usage.completionTokens}, total=${usage.totalTokens}`,
        );
      },
    });

    return result.toDataStreamResponse({
      getErrorMessage(error) {
        console.error(
          `Custom dashboard chat stream failed for ${dashboard.id}:`,
          error,
        );
        return "AI response failed. Please try again.";
      },
    });
  } catch (error) {
    console.error("Custom dashboard chat route failed:", error);
    return NextResponse.json(
      { error: "Unable to process dashboard chat right now" },
      { status: 500 },
    );
  }
}
