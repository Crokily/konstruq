import { AgingChart } from "@/components/charts/aging-chart";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { ChangeOrderWaterfall } from "@/components/charts/change-order-waterfall";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MockDataProvider, type ProjectFinancials } from "@/lib/data";

export default async function FinancialsPage() {
  const dataProvider = new MockDataProvider();

  const [cashFlowForecast, agingReport, projects] = await Promise.all([
    dataProvider.getCashFlowForecast(),
    dataProvider.getAgingReport(),
    dataProvider.getProjects(),
  ]);

  const [financialsByProject, changeOrdersByProject] = await Promise.all([
    Promise.all(projects.map((project) => dataProvider.getProjectFinancials(project.id))),
    Promise.all(projects.map((project) => dataProvider.getChangeOrders(project.id))),
  ]);

  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));

  const waterfallFinancials = financialsByProject
    .filter((financials): financials is ProjectFinancials => financials !== null)
    .map((financials) => ({
      ...financials,
      projectName: projectNameById.get(financials.projectId) ?? financials.projectId,
    }));

  const initialProjectId =
    waterfallFinancials[0]?.projectId ?? projects[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Financial Overview"
        description="Portfolio cash position, receivables exposure, and contract variation controls."
      />

      <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle>Cash Flow Forecast</CardTitle>
            <CardDescription>
              Accounts receivable vs payable with projected net cash flow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CashFlowChart data={cashFlowForecast} />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle>Aging Analysis</CardTitle>
            <CardDescription>
              AR and AP exposure by aging bucket
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AgingChart data={agingReport} />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle>Change Order Waterfall</CardTitle>
          <CardDescription>
            Original contract to revised total with project-level change-order deltas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangeOrderWaterfall
            projectId={initialProjectId}
            changeOrders={changeOrdersByProject.flat()}
            projectFinancials={waterfallFinancials}
          />
        </CardContent>
      </Card>
    </div>
  );
}
