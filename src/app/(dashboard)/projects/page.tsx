import { ProjectHealthScatter } from "@/components/charts/project-health-scatter";
import { ProjectTable } from "@/components/charts/project-table";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MockDataProvider } from "@/lib/data";

export default async function ProjectsPage() {
  const dataProvider = new MockDataProvider();
  const [projects, projectHealthMatrix] = await Promise.all([
    dataProvider.getProjects(),
    dataProvider.getProjectHealthMatrix(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portfolio"
        title="Projects"
        description="Enterprise project register with live health, budget, and schedule intelligence."
      />

      <Card className="border-border/70 bg-card/90 shadow-sm">
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

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle>Project List</CardTitle>
          <CardDescription>
            Click a row to open project details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectTable projects={projects} matrix={projectHealthMatrix} />
        </CardContent>
      </Card>
    </div>
  );
}
