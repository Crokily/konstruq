import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { resolveAppUserId } from "@/lib/db/app-user";
import {
  buildDashboardUserPrompt,
  callDashboardLLM,
  DASHBOARD_PROMPTS,
  DashboardGenerationError,
  fetchUserDatasetVersions,
  fetchUserDatasets,
  parseJsonResponse,
  type DashboardVariant,
} from "@/lib/dashboard/generate";
import {
  parseDashboardContent,
  buildDashboardDataVersion,
  buildDashboardCacheKey,
  type DashboardResponse,
} from "@/lib/dashboard/types";
import { getOrCreateDashboardServerCache, readDashboardServerCache } from "@/lib/dashboard/server-cache";

function isDashboardVariant(value: string): value is DashboardVariant {
  return value in DASHBOARD_PROMPTS;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.MISTRAL_API_KEY) {
      return NextResponse.json(
        { error: "MISTRAL_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const appUserId = await resolveAppUserId(userId);

    if (!appUserId) {
      return NextResponse.json(
        { error: "Unable to resolve user" },
        { status: 500 },
      );
    }

    let projectId: string | undefined;
    let variant: DashboardVariant = "executive";

    try {
      const body = (await request.json()) as {
        projectId?: unknown;
        variant?: unknown;
      };

      projectId =
        typeof body.projectId === "string" && body.projectId.length > 0
          ? body.projectId
          : undefined;

      if (typeof body.variant === "string" && body.variant.trim().length > 0) {
        if (!isDashboardVariant(body.variant)) {
          return NextResponse.json(
            { error: "Invalid dashboard variant" },
            { status: 400 },
          );
        }

        variant = body.variant;
      } else if (body.variant !== undefined && body.variant !== null) {
        return NextResponse.json(
          { error: "Invalid dashboard variant" },
          { status: 400 },
        );
      }
    } catch {
      // No body or invalid JSON means no project filter.
    }

    const datasetVersions = await fetchUserDatasetVersions({ appUserId, projectId });

    if (datasetVersions.length === 0) {
      return NextResponse.json({
        datasetIds: [],
        kpis: [],
        charts: [],
      } satisfies DashboardResponse);
    }

    const serverCacheKey = [
      appUserId,
      buildDashboardCacheKey({
        variant,
        projectId,
        dataVersion: buildDashboardDataVersion(datasetVersions),
      }),
    ].join("::");
    const cachedResponse = readDashboardServerCache(serverCacheKey);
    if (cachedResponse) {
      return NextResponse.json(cachedResponse);
    }

    const systemPrompt = DASHBOARD_PROMPTS[variant];
    const responsePayload = await getOrCreateDashboardServerCache(serverCacheKey, async () => {
      const datasetContext = await fetchUserDatasets(appUserId, projectId);
      const userPrompt = buildDashboardUserPrompt(datasetContext, variant);
      const responseText = await callDashboardLLM(systemPrompt, userPrompt);
      const parsed = parseDashboardContent(parseJsonResponse(responseText));

      if (!parsed || parsed.charts.length === 0) {
        throw new Error("AI response did not contain valid dashboard charts");
      }

      return {
        datasetIds: datasetContext.map((dataset) => dataset.id),
        kpis: parsed.kpis,
        charts: parsed.charts,
      } satisfies DashboardResponse;
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    if (error instanceof DashboardGenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Dashboard generation failed:", error);
    return NextResponse.json(
      { error: "Unable to generate dashboard right now" },
      { status: 500 },
    );
  }
}
