import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import {
  Building2,
  CheckCircle,
  Clock,
  DollarSign,
  ExternalLink,
  Plug,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { dataConnections, users } from "@/lib/db/schema";

import { ProcoreSyncButton } from "./procore-sync-button";
import { PROCORE_PROVIDER, procoreIntegration, sageIntacctIntegration } from "./constants";

function formatLastSync(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  const parsedDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

export default async function IntegrationsPage() {
  const { userId } = await auth();

  let procoreConnection: { lastSyncAt: Date | null } | null = null;

  if (userId) {
    const [appUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (appUser) {
      [procoreConnection] = await db
        .select({ lastSyncAt: dataConnections.lastSyncAt })
        .from(dataConnections)
        .where(
          and(
            eq(dataConnections.userId, appUser.id),
            eq(dataConnections.provider, PROCORE_PROVIDER),
            eq(dataConnections.isActive, true),
          ),
        )
        .limit(1);
    }
  }

  const isProcoreConnected = Boolean(procoreConnection);
  const lastSyncLabel = formatLastSync(procoreConnection?.lastSyncAt ?? null);

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-amber-500" />
          <h1 className="text-2xl font-bold">Integrations</h1>
        </div>
        <p className="mt-1 text-muted-foreground">
          Connect your construction data sources
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
        <Card className="border-border bg-card">
          <CardHeader className="space-y-4 pb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg border border-border bg-muted p-2">
                  <Building2 className="h-5 w-5 text-amber-500" />
                </div>
                <CardTitle>Procore</CardTitle>
              </div>
              {isProcoreConnected ? (
                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Connected
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-border bg-muted text-muted-foreground"
                >
                  Not Connected
                </Badge>
              )}
            </div>
            <CardDescription>
              Sync projects, budgets, RFIs, change orders, and schedules
            </CardDescription>
            {isProcoreConnected && lastSyncLabel ? (
              <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Last sync {lastSyncLabel}
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-2">
              {procoreIntegration.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  {feature}
                </li>
              ))}
            </ul>
            {isProcoreConnected ? (
              <ProcoreSyncButton />
            ) : (
              <Button
                asChild
                className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400"
              >
                <Link href="/api/procore/auth">
                  Connect Procore
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="space-y-4 pb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg border border-border bg-muted p-2">
                  <DollarSign className="h-5 w-5 text-cyan-400" />
                </div>
                <CardTitle>Sage Intacct</CardTitle>
              </div>
              <Badge className="border-sky-500/20 bg-sky-500/10 text-sky-200">
                Coming Soon
              </Badge>
            </div>
            <CardDescription>
              Access GL, AP/AR, cost types, and project financials
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-2">
              {sageIntacctIntegration.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <CheckCircle className="h-4 w-4 text-cyan-400" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button
              asChild
              variant="outline"
              className="w-full border-sky-500/30 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-200"
            >
              <Link href="mailto:support@konstruq.com?subject=Sage%20Intacct%20Early%20Access">
                Request Early Access
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
