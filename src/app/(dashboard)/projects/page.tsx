import { ProjectHealthScatter } from "@/components/charts/project-health-scatter";
import { ProjectTable } from "@/components/charts/project-table";
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Projects</h1>
        <p className="mt-1 text-muted-foreground">
          All construction projects from Procore.
        </p>
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

      <Card className="border-border bg-card">
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
