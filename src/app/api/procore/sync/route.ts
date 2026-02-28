import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { dataConnections, syncedProjects, users } from "@/lib/db/schema";

interface ProcoreConnectionCredentials {
  accessToken: string;
  refreshToken?: string;
  companyId: string;
  expiresAt?: string;
}

type ProcoreProjectPayload = Record<string, unknown> & {
  id?: number | string;
};

const PROCORE_PROVIDER = "procore";

function isProcoreConnectionCredentials(
  value: unknown,
): value is ProcoreConnectionCredentials {
  if (!value || typeof value !== "object") {
    return false;
  }

  const raw = value as Record<string, unknown>;

  return (
    typeof raw.accessToken === "string" &&
    raw.accessToken.length > 0 &&
    typeof raw.companyId === "string" &&
    raw.companyId.length > 0
  );
}

function isProjectPayload(value: unknown): value is ProcoreProjectPayload {
  return typeof value === "object" && value !== null;
}

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiBaseUrl = process.env.PROCORE_API_BASE_URL;

  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: "Procore API base URL is missing" },
      { status: 500 },
    );
  }

  const [appUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!appUser) {
    return NextResponse.json(
      { error: "User record not found. Connect Procore first." },
      { status: 404 },
    );
  }

  const [connection] = await db
    .select()
    .from(dataConnections)
    .where(
      and(
        eq(dataConnections.userId, appUser.id),
        eq(dataConnections.provider, PROCORE_PROVIDER),
        eq(dataConnections.isActive, true),
      ),
    )
    .limit(1);

  if (!connection) {
    return NextResponse.json(
      { error: "No active Procore connection found" },
      { status: 404 },
    );
  }

  if (!isProcoreConnectionCredentials(connection.credentials)) {
    return NextResponse.json(
      { error: "Stored Procore credentials are invalid" },
      { status: 500 },
    );
  }

  let projects: ProcoreProjectPayload[] = [];

  try {
    const projectsUrl = new URL("/rest/v1.1/projects", apiBaseUrl);
    projectsUrl.searchParams.set("per_page", "100");

    const projectResponse = await fetch(projectsUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${connection.credentials.accessToken}`,
        "Procore-Company-Id": connection.credentials.companyId,
        Accept: "application/json",
      },
    });

    if (!projectResponse.ok) {
      const projectErrorText = await projectResponse.text();
      return NextResponse.json(
        {
          error: "Failed to fetch projects from Procore",
          details: projectErrorText,
        },
        { status: 502 },
      );
    }

    const projectsPayload = (await projectResponse.json()) as unknown;

    if (!Array.isArray(projectsPayload)) {
      return NextResponse.json(
        { error: "Unexpected project response shape from Procore" },
        { status: 502 },
      );
    }

    projects = projectsPayload.filter(isProjectPayload);
  } catch (error) {
    console.error("Failed fetching projects from Procore:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects from Procore" },
      { status: 502 },
    );
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  try {
    await db.transaction(async (tx) => {
      const now = new Date();

      for (const project of projects) {
        const projectId = project.id;

        if (projectId === undefined || projectId === null) {
          skipped += 1;
          continue;
        }

        const externalId = String(projectId);

        const [existingProject] = await tx
          .select({ id: syncedProjects.id })
          .from(syncedProjects)
          .where(
            and(
              eq(syncedProjects.externalId, externalId),
              eq(syncedProjects.source, PROCORE_PROVIDER),
            ),
          )
          .limit(1);

        if (existingProject) {
          await tx
            .update(syncedProjects)
            .set({
              connectionId: connection.id,
              data: project,
              syncedAt: now,
            })
            .where(eq(syncedProjects.id, existingProject.id));
          updated += 1;
        } else {
          await tx.insert(syncedProjects).values({
            connectionId: connection.id,
            externalId,
            source: PROCORE_PROVIDER,
            data: project,
            syncedAt: now,
          });
          inserted += 1;
        }
      }

      await tx
        .update(dataConnections)
        .set({
          lastSyncAt: now,
          updatedAt: now,
        })
        .where(eq(dataConnections.id, connection.id));
    });
  } catch (error) {
    console.error("Failed storing synced Procore projects:", error);
    return NextResponse.json(
      { error: "Failed to persist synced Procore projects" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    total: projects.length,
    inserted,
    updated,
    skipped,
  });
}
