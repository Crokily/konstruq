import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { resolveAppUserId } from "@/lib/db/app-user";
import { db } from "@/lib/db";
import { customDashboards, dashboardWidgets } from "@/lib/db/schema";

interface WidgetByIdRouteContext {
  params: Promise<{ id: string; widgetId: string }>;
}

async function getOwnedWidget(
  appUserId: string,
  dashboardId: string,
  widgetId: string,
) {
  const [widget] = await db
    .select({
      id: dashboardWidgets.id,
      dashboardId: dashboardWidgets.dashboardId,
    })
    .from(dashboardWidgets)
    .innerJoin(customDashboards, eq(dashboardWidgets.dashboardId, customDashboards.id))
    .where(
      and(
        eq(dashboardWidgets.id, widgetId),
        eq(dashboardWidgets.dashboardId, dashboardId),
        eq(customDashboards.userId, appUserId),
        eq(customDashboards.status, "active"),
      ),
    )
    .limit(1);

  return widget;
}

export async function DELETE(
  _request: NextRequest,
  { params }: WidgetByIdRouteContext,
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

    const { id, widgetId } = await params;
    const dashboardId = id.trim();
    const normalizedWidgetId = widgetId.trim();

    if (!dashboardId) {
      return NextResponse.json({ error: "Invalid dashboard id" }, { status: 400 });
    }

    if (!normalizedWidgetId) {
      return NextResponse.json({ error: "Invalid widget id" }, { status: 400 });
    }

    const ownedWidget = await getOwnedWidget(
      appUserId,
      dashboardId,
      normalizedWidgetId,
    );

    if (!ownedWidget) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 });
    }

    await db
      .delete(dashboardWidgets)
      .where(
        and(
          eq(dashboardWidgets.id, ownedWidget.id),
          eq(dashboardWidgets.dashboardId, ownedWidget.dashboardId),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Dashboard widget DELETE route failed:", error);
    return NextResponse.json(
      { error: "Unable to delete dashboard widget right now" },
      { status: 500 },
    );
  }
}
