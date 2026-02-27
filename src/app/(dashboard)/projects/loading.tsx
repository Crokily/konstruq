import { Skeleton } from "@/components/ui/skeleton"

export default function ProjectsLoading() {
  return (
    <div className="space-y-6">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-40 bg-slate-800" />
        <Skeleton className="h-4 w-72 bg-slate-800" />
      </div>

      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <Skeleton className="h-6 w-32 bg-slate-800" />
        <Skeleton className="h-4 w-64 bg-slate-800" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton
              key={`project-row-skeleton-${index}`}
              className="h-10 w-full rounded-md bg-slate-800/80"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
