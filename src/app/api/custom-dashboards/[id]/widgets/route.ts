import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { resolveAppUserId } from "@/lib/db/app-user";
import { db } from "@/lib/db";
import { customDashboards, dashboardWidgets } from "@/lib/db/schema";

interface WidgetsRouteContext {
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
  { params }: WidgetsRouteContext,
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

    if (!isRecord(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const widgetType =
      typeof body.widgetType === "string" ? body.widgetType.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!widgetType) {
      return NextResponse.json({ error: "widgetType is required" }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (!Object.prototype.hasOwnProperty.call(body, "config")) {
      return NextResponse.json({ error: "config is required" }, { status: 400 });
    }

    let sortOrder: number;

    if (Object.prototype.hasOwnProperty.call(body, "sortOrder")) {
      const sortOrderValue = body.sortOrder;

      if (
        typeof sortOrderValue !== "number" ||
        !Number.isInteger(sortOrderValue) ||
        sortOrderValue < 0
      ) {
        return NextResponse.json(
          { error: "sortOrder must be a non-negative integer" },
          { status: 400 },
        );
      }

      sortOrder = sortOrderValue;
    } else {
      const [lastWidget] = await db
        .select({ sortOrder: dashboardWidgets.sortOrder })
        .from(dashboardWidgets)
        .where(eq(dashboardWidgets.dashboardId, dashboard.id))
        .orderBy(desc(dashboardWidgets.sortOrder))
        .limit(1);

      sortOrder = (lastWidget?.sortOrder ?? -1) + 1;
    }

    const [createdWidget] = await db
      .insert(dashboardWidgets)
      .values({
        dashboardId: dashboard.id,
        widgetType,
        title,
        config: body.config,
        sortOrder,
      })
      .returning({
        id: dashboardWidgets.id,
        dashboardId: dashboardWidgets.dashboardId,
        widgetType: dashboardWidgets.widgetType,
        title: dashboardWidgets.title,
        config: dashboardWidgets.config,
        sortOrder: dashboardWidgets.sortOrder,
        createdAt: dashboardWidgets.createdAt,
        updatedAt: dashboardWidgets.updatedAt,
      });

    if (!createdWidget) {
      return NextResponse.json(
        { error: "Failed to create dashboard widget" },
        { status: 500 },
      );
    }

    return NextResponse.json(createdWidget);
  } catch (error) {
    console.error("Dashboard widgets POST route failed:", error);
    return NextResponse.json(
      { error: "Unable to create dashboard widget right now" },
      { status: 500 },
    );
  }
}
