import { currentUser } from "@clerk/nextjs/server";
import { KPICards } from "@/components/charts/kpi-cards";
import { ProjectHealthScatter } from "@/components/charts/project-health-scatter";
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

  const [kpis, projects, revenueExpenseTrend, projectHealthMatrix] = await Promise.all([
    dataProvider.getPortfolioKPIs(),
    dataProvider.getProjects(),
    dataProvider.getRevenueExpenseTrend(),
    dataProvider.getProjectHealthMatrix(),
  ]);

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          Welcome back, {user?.firstName || "there"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here&apos;s your construction portfolio overview.
        </p>
      </div>

      <KPICards kpis={kpis} />

      <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle>Project Status</CardTitle>
            <CardDescription>
              Distribution by current stage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectStatusChart projects={projects} />
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle>Revenue vs Expenses</CardTitle>
            <CardDescription>
              Rolling 12-month trend
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueExpenseChart data={revenueExpenseTrend} />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle>Project Health Matrix</CardTitle>
          <CardDescription>
            Schedule completion compared to budget burn
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectHealthScatter matrix={projectHealthMatrix} projects={projects} />
        </CardContent>
      </Card>
    </div>
  );
}
