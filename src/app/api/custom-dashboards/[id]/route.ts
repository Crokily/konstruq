import { auth } from "@clerk/nextjs/server";
import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { resolveAppUserId } from "@/lib/db/app-user";
import { db } from "@/lib/db";
import { customDashboards, dashboardWidgets } from "@/lib/db/schema";

interface CustomDashboardRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: CustomDashboardRouteContext,
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

    const { id } = await params;

    if (id.trim().length === 0) {
      return NextResponse.json({ error: "Invalid dashboard id" }, { status: 400 });
    }

    const [dashboard] = await db
      .select({
        id: customDashboards.id,
        name: customDashboards.name,
        description: customDashboards.description,
        projectId: customDashboards.projectId,
        status: customDashboards.status,
        createdAt: customDashboards.createdAt,
        updatedAt: customDashboards.updatedAt,
      })
      .from(customDashboards)
      .where(
        and(
          eq(customDashboards.id, id),
          eq(customDashboards.userId, appUserId),
          eq(customDashboards.status, "active"),
        ),
      )
      .limit(1);

    if (!dashboard) {
      return NextResponse.json(
        { error: "Custom dashboard not found" },
        { status: 404 },
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

    return NextResponse.json({
      ...dashboard,
      widgets,
    });
  } catch (error) {
    console.error("Custom dashboard GET by id route failed:", error);
    return NextResponse.json(
      { error: "Unable to load custom dashboard right now" },
      { status: 500 },
    );
  }
}
