import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { Card, CardContent } from "@/components/ui/card";

import { CustomDashboardCanvas } from "@/components/dashboard/custom-dashboard-canvas";
import { resolveAppUserId } from "@/lib/db/app-user";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { parseCustomDashboardDetail } from "@/lib/dashboard/custom-dashboard";

interface CustomDashboardPageParams {
  id: string;
  dashboardId: string;
}

interface CustomDashboardRoutePayload {
  error?: string;
}

function resolveBaseUrl(requestHeaders: Headers): string | null {
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");

  if (!host) {
    return process.env.NEXT_PUBLIC_APP_URL ?? null;
  }

  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

async function requestCustomDashboard(dashboardId: string) {
  const requestHeaders = await headers();
  const baseUrl = resolveBaseUrl(requestHeaders);

  if (!baseUrl) {
    throw new Error("Unable to resolve the application URL.");
  }

  const response = await fetch(`${baseUrl}/api/custom-dashboards/${dashboardId}`, {
    method: "GET",
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as
    | CustomDashboardRoutePayload
    | unknown;

  if (!response.ok) {
    throw new Error(
      payload &&
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof payload.error === "string"
        ? payload.error
        : "Unable to load custom dashboard right now.",
    );
  }

  return parseCustomDashboardDetail(payload);
}

export default async function CustomDashboardPage({
  params,
}: {
  params: Promise<CustomDashboardPageParams>;
}) {
  const { id: projectId, dashboardId } = await params;
  const { userId } = await auth();

  if (!userId) {
    return (
      <Card className="border-border/70 bg-card shadow-sm">
        <CardContent className="py-12 text-center text-muted-foreground">
          Dashboard not found
        </CardContent>
      </Card>
    );
  }

  const appUserId = await resolveAppUserId(userId);

  if (!appUserId) {
    return (
      <Card className="border-border/70 bg-card shadow-sm">
        <CardContent className="py-12 text-center text-muted-foreground">
          Dashboard not found
        </CardContent>
      </Card>
    );
  }

  const [project, dashboard] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, appUserId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    requestCustomDashboard(dashboardId),
  ]);

  if (!project || !dashboard || dashboard.projectId !== project.id) {
    return (
      <Card className="border-border/70 bg-card shadow-sm">
        <CardContent className="py-12 text-center text-muted-foreground">
          Dashboard not found
        </CardContent>
      </Card>
    );
  }

  return (
    <CustomDashboardCanvas
      dashboard={dashboard}
      projectId={project.id}
      projectName={project.name}
    />
  );
}
