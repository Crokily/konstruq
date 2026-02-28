import { CostBreakdownChart } from "@/components/charts/cost-breakdown-chart";
import { EVMChart } from "@/components/charts/evm-chart";
import { EVMKpiBadges } from "@/components/charts/evm-kpi-badges";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MockDataProvider } from "@/lib/data";
import { cn } from "@/lib/utils";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  const parsedDate = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return dateFormatter.format(parsedDate);
}

function DataSourceBadge({ source }: { source: "Procore" | "Sage Intacct" }) {
  const isProcore = source === "Procore";

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-[11px] uppercase tracking-wide",
        isProcore
          ? "border-amber-400/30 bg-amber-500/15 text-amber-300"
          : "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
      )}
    >
      {source}
    </Badge>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dataProvider = new MockDataProvider();

  const [project, financials, costBreakdown, evmData] = await Promise.all([
    dataProvider.getProjectById(id),
    dataProvider.getProjectFinancials(id),
    dataProvider.getCostBreakdown(id),
    dataProvider.getEVMData(id),
  ]);

  if (!project || !financials || !costBreakdown) {
    return (
      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="py-12 text-center text-slate-300">
          Project not found
        </CardContent>
      </Card>
    );
  }

  const progress = Math.max(0, Math.min(100, project.percentComplete));

  return (
    <div className="space-y-6">
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl text-slate-100">{project.name}</CardTitle>
              <CardDescription className="mt-1 text-slate-400">
                {project.type} project in {project.city}, {project.state}
              </CardDescription>
            </div>
            <DataSourceBadge source="Procore" />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-4 gap-4 text-sm max-xl:grid-cols-2 max-sm:grid-cols-1">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Project Type</p>
              <p className="mt-1 text-slate-100">{project.type}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Location</p>
              <p className="mt-1 text-slate-100">
                {project.city}, {project.state}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Start Date</p>
              <p className="mt-1 text-slate-100">{formatDate(project.startDate)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Completion Date</p>
              <p className="mt-1 text-slate-100">{formatDate(project.completionDate)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm max-md:grid-cols-1">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Value</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">
                {currencyFormatter.format(project.totalValue)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Revised Contract Value
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-100">
                {currencyFormatter.format(financials.revisedContractAmount)}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Percent Complete</span>
              <span className="font-medium text-slate-100">{progress}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-800">
              <div className="h-2.5 rounded-full bg-amber-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-slate-100">EVM KPI Summary</CardTitle>
              <CardDescription className="text-slate-400">
                Calculated from the latest monthly EVM data point
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DataSourceBadge source="Procore" />
              <DataSourceBadge source="Sage Intacct" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <EVMKpiBadges data={evmData} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-slate-100">Cost Breakdown</CardTitle>
                <CardDescription className="text-slate-400">
                  Budget vs actual vs committed by category
                </CardDescription>
              </div>
              <DataSourceBadge source="Sage Intacct" />
            </div>
          </CardHeader>
          <CardContent>
            <CostBreakdownChart data={costBreakdown} />
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-slate-100">EVM Trend</CardTitle>
                <CardDescription className="text-slate-400">
                  Planned value, earned value, and actual cost over 2025
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <DataSourceBadge source="Procore" />
                <DataSourceBadge source="Sage Intacct" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <EVMChart data={evmData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
