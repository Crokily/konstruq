import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import Link from "next/link";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { resolveAppUserId } from "@/lib/db/app-user";
import {
  buildDashboardCacheKey,
  buildDashboardDataVersion,
} from "@/lib/dashboard/types";
import { projects, uploadedDatasets } from "@/lib/db/schema";

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    return (
      <Card className="border-border/70 bg-card shadow-sm">
        <CardContent className="py-12 text-center text-muted-foreground">
          Project not found
        </CardContent>
      </Card>
    );
  }

  const appUserId = await resolveAppUserId(userId);

  if (!appUserId) {
    return (
      <Card className="border-border/70 bg-card shadow-sm">
        <CardContent className="py-12 text-center text-muted-foreground">
          Project not found
        </CardContent>
      </Card>
    );
  }

  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
    })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, appUserId)))
    .limit(1);

  if (!project) {
    return (
      <Card className="border-border/70 bg-card shadow-sm">
        <CardContent className="py-12 text-center text-muted-foreground">
          Project not found
        </CardContent>
      </Card>
    );
  }

  const activeDatasets = await db
    .select({
      id: uploadedDatasets.id,
      uploadedAt: uploadedDatasets.uploadedAt,
    })
    .from(uploadedDatasets)
    .where(
      and(
        eq(uploadedDatasets.userId, appUserId),
        eq(uploadedDatasets.projectId, id),
        eq(uploadedDatasets.isActive, true),
      ),
    );

  const activeDatasetCount = activeDatasets.length;

  if (activeDatasetCount === 0) {
    return (
      <Card className="border-border/70 bg-card shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="space-y-2">
            <h2 className="text-lg font-medium text-foreground">
              No active datasets for this project
            </h2>
            <p className="text-sm text-muted-foreground">
              Upload project datasets to generate the AI project controls dashboard.
            </p>
          </div>
          <Button asChild>
            <Link href="/data-sources">Go to Data Sources</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const cacheKey = buildDashboardCacheKey({
    variant: "project-controls",
    projectId: project.id,
    dataVersion: buildDashboardDataVersion(activeDatasets),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Project Controls Dashboard"
        title={project.name}
        description={
          project.description?.trim()
            ? project.description.trim()
            : `AI-generated controls insights from ${activeDatasetCount} active dataset${
                activeDatasetCount === 1 ? "" : "s"
              }.`
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/data-sources">Manage Data Sources</Link>
          </Button>
        }
      />

      <DashboardClient
        datasetIds={activeDatasets.map((dataset) => dataset.id)}
        cacheKey={cacheKey}
        projectId={project.id}
        variant="project-controls"
      />
    </div>
  );
}
