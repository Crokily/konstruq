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
        <p className="text-slate-400 mt-1">
          All construction projects from Procore.
        </p>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-slate-100">Project Health Matrix</CardTitle>
          <CardDescription className="text-slate-400">
            Schedule completion compared to budget burn
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectHealthScatter matrix={projectHealthMatrix} projects={projects} />
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader className="pb-0">
          <CardTitle className="text-slate-100">Project List</CardTitle>
          <CardDescription className="text-slate-400">
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
