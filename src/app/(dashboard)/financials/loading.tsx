import { Skeleton } from "@/components/ui/skeleton"

export default function FinancialsLoading() {
  return (
    <div className="space-y-6">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-64 bg-slate-800" />
        <Skeleton className="h-4 w-72 bg-slate-800" />
      </div>

      <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={`financial-chart-skeleton-${index}`}
            className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6"
          >
            <Skeleton className="h-6 w-44 bg-slate-800" />
            <Skeleton className="h-4 w-72 bg-slate-800" />
            <Skeleton className="h-72 w-full rounded-lg bg-slate-800/70" />
          </div>
        ))}
      </div>

      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <Skeleton className="h-6 w-52 bg-slate-800" />
        <Skeleton className="h-4 w-80 bg-slate-800" />
        <Skeleton className="h-80 w-full rounded-lg bg-slate-800/70" />
      </div>
    </div>
  )
}
