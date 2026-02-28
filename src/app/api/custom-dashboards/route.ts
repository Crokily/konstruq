import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { resolveAppUserId } from "@/lib/db/app-user";
import { db } from "@/lib/db";
import {
  customDashboards,
  dashboardWidgets,
  projects,
} from "@/lib/db/schema";

interface CreateDashboardBody {
  projectId?: unknown;
  name?: unknown;
  description?: unknown;
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUserId = await resolveAppUserId(userId);

    if (!appUserId) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 });
    }

    const projectIdParam = request.nextUrl.searchParams.get("projectId");
    const projectId =
      typeof projectIdParam === "string" ? projectIdParam.trim() : null;

    if (projectIdParam !== null && !projectId) {
      return NextResponse.json(
        { error: "projectId must be a non-empty string" },
        { status: 400 },
      );
    }

    const dashboards = await db
      .select({
        id: customDashboards.id,
        name: customDashboards.name,
        description: customDashboards.description,
        projectId: customDashboards.projectId,
        projectName: projects.name,
        status: customDashboards.status,
        createdAt: customDashboards.createdAt,
        updatedAt: customDashboards.updatedAt,
      })
      .from(customDashboards)
      .innerJoin(projects, eq(customDashboards.projectId, projects.id))
      .where(
        projectId
          ? and(
              eq(customDashboards.userId, appUserId),
              eq(customDashboards.status, "active"),
              eq(customDashboards.projectId, projectId),
              eq(projects.userId, appUserId),
            )
          : and(
              eq(customDashboards.userId, appUserId),
              eq(customDashboards.status, "active"),
              eq(projects.userId, appUserId),
            ),
      )
      .orderBy(desc(customDashboards.updatedAt));

    if (dashboards.length === 0) {
      return NextResponse.json([]);
    }

    const dashboardIds = dashboards.map((dashboard) => dashboard.id);
    const widgets = await db
      .select({ dashboardId: dashboardWidgets.dashboardId })
      .from(dashboardWidgets)
      .where(inArray(dashboardWidgets.dashboardId, dashboardIds));

    const widgetCountByDashboardId = new Map<string, number>();

    for (const widget of widgets) {
      widgetCountByDashboardId.set(
        widget.dashboardId,
        (widgetCountByDashboardId.get(widget.dashboardId) ?? 0) + 1,
      );
    }

    return NextResponse.json(
      dashboards.map((dashboard) => ({
        ...dashboard,
        widgetCount: widgetCountByDashboardId.get(dashboard.id) ?? 0,
      })),
    );
  } catch (error) {
    console.error("Custom dashboards GET route failed:", error);
    return NextResponse.json(
      { error: "Unable to load custom dashboards right now" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUserId = await resolveAppUserId(userId);

    if (!appUserId) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 });
    }

    let body: CreateDashboardBody;

    try {
      body = (await request.json()) as CreateDashboardBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const projectId =
      typeof body.projectId === "string" ? body.projectId.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (
      body.description !== undefined &&
      body.description !== null &&
      typeof body.description !== "string"
    ) {
      return NextResponse.json(
        { error: "description must be a string" },
        { status: 400 },
      );
    }

    const description =
      typeof body.description === "string" ? body.description.trim() : "";

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.userId, appUserId),
          eq(projects.status, "active"),
        ),
      )
      .limit(1);

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or inactive" },
        { status: 404 },
      );
    }

    const [createdDashboard] = await db
      .insert(customDashboards)
      .values({
        userId: appUserId,
        projectId,
        name,
        description: description || null,
      })
      .returning({
        id: customDashboards.id,
        name: customDashboards.name,
        description: customDashboards.description,
        projectId: customDashboards.projectId,
        status: customDashboards.status,
        createdAt: customDashboards.createdAt,
      });

    if (!createdDashboard) {
      return NextResponse.json(
        { error: "Failed to create custom dashboard" },
        { status: 500 },
      );
    }

    return NextResponse.json(createdDashboard);
  } catch (error) {
    console.error("Custom dashboards POST route failed:", error);
    return NextResponse.json(
      { error: "Unable to create custom dashboard right now" },
      { status: 500 },
    );
  }
}
