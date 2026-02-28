import { auth } from "@clerk/nextjs/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { resolveAppUserId } from "@/lib/db/app-user";
import { db } from "@/lib/db";
import { customDashboards, dashboardWidgets } from "@/lib/db/schema";

interface WidgetsReorderRouteContext {
  params: Promise<{ id: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getOwnedDashboard(appUserId: string, dashboardId: string) {
  const [dashboard] = await db
    .select({ id: customDashboards.id })
    .from(customDashboards)
    .where(
      and(
        eq(customDashboards.id, dashboardId),
        eq(customDashboards.userId, appUserId),
        eq(customDashboards.status, "active"),
      ),
    )
    .limit(1);

  return dashboard;
}

export async function POST(
  request: NextRequest,
  { params }: WidgetsReorderRouteContext,
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUserId = await resolveAppUserId(userId);

    if (!appUserId) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 });
    }

    const { id } = await params;
    const dashboardId = id.trim();

    if (!dashboardId) {
      return NextResponse.json({ error: "Invalid dashboard id" }, { status: 400 });
    }

    const dashboard = await getOwnedDashboard(appUserId, dashboardId);

    if (!dashboard) {
      return NextResponse.json(
        { error: "Custom dashboard not found" },
        { status: 404 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!isRecord(body) || !Array.isArray(body.widgetIds)) {
      return NextResponse.json(
        { error: "widgetIds must be an array of strings" },
        { status: 400 },
      );
    }

    const widgetIds = body.widgetIds.map((widgetId) =>
      typeof widgetId === "string" ? widgetId.trim() : "",
    );

    if (widgetIds.some((widgetId) => widgetId.length === 0)) {
      return NextResponse.json(
        { error: "widgetIds must contain non-empty strings" },
        { status: 400 },
      );
    }

    if (new Set(widgetIds).size !== widgetIds.length) {
      return NextResponse.json(
        { error: "widgetIds must be unique" },
        { status: 400 },
      );
    }

    if (widgetIds.length > 0) {
      const matchedWidgets = await db
        .select({ id: dashboardWidgets.id })
        .from(dashboardWidgets)
        .where(
          and(
            eq(dashboardWidgets.dashboardId, dashboard.id),
            inArray(dashboardWidgets.id, widgetIds),
          ),
        );

      if (matchedWidgets.length !== widgetIds.length) {
        return NextResponse.json(
          { error: "One or more widgets were not found" },
          { status: 404 },
        );
      }

      await Promise.all(
        widgetIds.map((widgetId, sortOrder) =>
          db
            .update(dashboardWidgets)
            .set({ sortOrder, updatedAt: new Date() })
            .where(
              and(
                eq(dashboardWidgets.id, widgetId),
                eq(dashboardWidgets.dashboardId, dashboard.id),
              ),
            ),
        ),
      );
    }

    const widgets = await db
      .select({
        id: dashboardWidgets.id,
        dashboardId: dashboardWidgets.dashboardId,
        widgetType: dashboardWidgets.widgetType,
        title: dashboardWidgets.title,
        config: dashboardWidgets.config,
        sortOrder: dashboardWidgets.sortOrder,
        createdAt: dashboardWidgets.createdAt,
        updatedAt: dashboardWidgets.updatedAt,
      })
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.dashboardId, dashboard.id))
      .orderBy(asc(dashboardWidgets.sortOrder));

    return NextResponse.json({ widgets });
  } catch (error) {
    console.error("Dashboard widgets reorder POST route failed:", error);
    return NextResponse.json(
      { error: "Unable to reorder dashboard widgets right now" },
      { status: 500 },
    );
  }
}
