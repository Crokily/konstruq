import { currentUser } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { db } from "@/lib/db";
import { resolveAppUserId } from "@/lib/db/app-user";
import {
  buildDashboardCacheKey,
  buildDashboardDataVersion,
} from "@/lib/dashboard/types";
import { uploadedDatasets } from "@/lib/db/schema";

export default async function FinancialsPage() {
  const user = await currentUser();

  if (!user?.id) {
    return <EmptyDashboard firstName={null} />;
  }

  const appUserId = await resolveAppUserId(user.id);

  if (!appUserId) {
    return <EmptyDashboard firstName={user.firstName} />;
  }

  const datasets = await db
    .select({
      id: uploadedDatasets.id,
      uploadedAt: uploadedDatasets.uploadedAt,
    })
    .from(uploadedDatasets)
    .where(
      and(
        eq(uploadedDatasets.userId, appUserId),
        eq(uploadedDatasets.isActive, true),
      ),
    )
    .orderBy(desc(uploadedDatasets.uploadedAt));

  if (datasets.length === 0) {
    return <EmptyDashboard firstName={user.firstName} />;
  }

  const cacheKey = buildDashboardCacheKey({
    variant: "financials",
    dataVersion: buildDashboardDataVersion(datasets),
  });

  return (
    <DashboardClient
      datasetIds={datasets.map((dataset) => dataset.id)}
      cacheKey={cacheKey}
      firstName={user.firstName}
      variant="financials"
    />
  );
}
