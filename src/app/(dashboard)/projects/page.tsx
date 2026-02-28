import { Card } from "@/components/ui/card";
import { FolderKanban } from "lucide-react";

export default function ProjectsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Projects</h1>
        <p className="text-muted-foreground mt-1">
          All construction projects from Procore.
        </p>
      </div>

      <Card className="border-dashed p-12 text-center">
        <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
        <p className="text-muted-foreground">
          Connect Procore to sync your construction projects.
        </p>
      </Card>
    </div>
  );
}
