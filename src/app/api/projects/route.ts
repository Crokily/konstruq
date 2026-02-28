import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { resolveAppUserId } from "@/lib/db/app-user";
import { db } from "@/lib/db";
import { projects, uploadedDatasets } from "@/lib/db/schema";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUserId = await resolveAppUserId(userId);

    if (!appUserId) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 });
    }

    const userProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.userId, appUserId))
      .orderBy(desc(projects.updatedAt));

    const activeProjects = userProjects.filter(
      (project) => project.status !== "archived",
    );

    const activeDatasets = await db
      .select({ projectId: uploadedDatasets.projectId })
      .from(uploadedDatasets)
      .where(
        and(
          eq(uploadedDatasets.userId, appUserId),
          eq(uploadedDatasets.isActive, true),
        ),
      );

    const datasetCounts = new Map<string, number>();

    for (const dataset of activeDatasets) {
      if (!dataset.projectId) {
        continue;
      }

      datasetCounts.set(
        dataset.projectId,
        (datasetCounts.get(dataset.projectId) ?? 0) + 1,
      );
    }

    return NextResponse.json(
      activeProjects.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        datasetCount: datasetCounts.get(project.id) ?? 0,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })),
    );
  } catch (error) {
    console.error("Projects GET route failed:", error);
    return NextResponse.json(
      { error: "Unable to load projects right now" },
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

    const body = (await request.json()) as {
      name?: unknown;
      description?: unknown;
    };

    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 },
      );
    }

    const name = body.name.trim();
    const description =
      typeof body.description === "string" ? body.description.trim() : "";

    const [createdProject] = await db
      .insert(projects)
      .values({
        userId: appUserId,
        name,
        description: description || null,
      })
      .returning({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        createdAt: projects.createdAt,
      });

    if (!createdProject) {
      return NextResponse.json(
        { error: "Failed to create project" },
        { status: 500 },
      );
    }

    return NextResponse.json(createdProject);
  } catch (error) {
    console.error("Projects POST route failed:", error);
    return NextResponse.json(
      { error: "Unable to create project right now" },
      { status: 500 },
    );
  }
}
