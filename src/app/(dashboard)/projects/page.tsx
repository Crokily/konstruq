import { Card } from "@/components/ui/card";
import { FolderKanban } from "lucide-react";

export default function ProjectsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Projects</h1>
        <p className="text-slate-400 mt-1">
          All construction projects from Procore.
        </p>
      </div>

      <Card className="border-dashed border-slate-700 bg-slate-900/30 p-12 text-center">
        <FolderKanban className="h-12 w-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
        <p className="text-slate-400">
          Connect Procore to sync your construction projects.
        </p>
      </Card>
    </div>
  );
}
