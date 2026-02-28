import { currentUser } from "@clerk/nextjs/server";
import {
  Building2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await currentUser();

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          Welcome back, {user?.firstName || "there"}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s your construction portfolio overview.
        </p>
      </div>

      {/* KPI Cards - Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          title="Active Projects"
          value="—"
          subtitle="Connect Procore to see data"
          icon={<Building2 className="h-5 w-5" />}
          iconColor="text-amber-500"
          iconBg="bg-amber-500/10"
        />
        <KPICard
          title="Total Contract Value"
          value="—"
          subtitle="Connect Sage Intacct to see data"
          icon={<DollarSign className="h-5 w-5" />}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/10"
        />
        <KPICard
          title="Avg. CPI"
          value="—"
          subtitle="Cost Performance Index"
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor="text-blue-500"
          iconBg="bg-blue-500/10"
        />
        <KPICard
          title="At Risk Projects"
          value="—"
          subtitle="Over budget or behind schedule"
          icon={<AlertTriangle className="h-5 w-5" />}
          iconColor="text-red-500"
          iconBg="bg-red-500/10"
        />
      </div>

      {/* Empty state - prompt to connect data sources */}
      <Card className="border-dashed p-12 text-center">
        <div className="mx-auto max-w-md">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            Connect your data sources
          </h2>
          <p className="text-muted-foreground mb-6">
            Link your Procore and Sage Intacct accounts to start seeing
            real-time construction analytics.
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href="/integrations"
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-600 transition-colors"
            >
              Set Up Integrations
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}

function KPICard({
  title,
  value,
  subtitle,
  icon,
  iconColor,
  iconBg,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className={`${iconBg} ${iconColor} rounded-lg p-2`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </Card>
  );
}
