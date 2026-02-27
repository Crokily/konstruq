import { currentUser } from "@clerk/nextjs/server";
import { KPICards } from "@/components/charts/kpi-cards";
import { ProjectStatusChart } from "@/components/charts/project-status-chart";
import { RevenueExpenseChart } from "@/components/charts/revenue-expense-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MockDataProvider } from "@/lib/data";

export default async function DashboardPage() {
  const user = await currentUser();
  const dataProvider = new MockDataProvider();

  const [kpis, projects, revenueExpenseTrend] = await Promise.all([
    dataProvider.getPortfolioKPIs(),
    dataProvider.getProjects(),
    dataProvider.getRevenueExpenseTrend(),
  ]);

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">
          Welcome back, {user?.firstName || "there"}
        </h1>
        <p className="text-slate-400 mt-1">
          Here&apos;s your construction portfolio overview.
        </p>
      </div>

      <KPICards kpis={kpis} />

      <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-100">Project Status</CardTitle>
            <CardDescription className="text-slate-400">
              Distribution by current stage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectStatusChart projects={projects} />
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-100">Revenue vs Expenses</CardTitle>
            <CardDescription className="text-slate-400">
              Rolling 12-month trend
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueExpenseChart data={revenueExpenseTrend} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
