import { Card } from "@/components/ui/card";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Project Detail</h1>
        <p className="text-slate-400 mt-1">Project ID: {id}</p>
      </div>

      <Card className="border-slate-800 bg-slate-900/50 p-8 text-center">
        <p className="text-slate-400">
          Project detail view will show EVM charts, cost breakdowns, Gantt
          charts, and change order tracking after data sources are connected.
        </p>
      </Card>
    </div>
  );
}
