import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="hidden w-64 p-4 bg-white border-r md:block dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center mb-8 space-x-2">
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="w-24 h-6" />
        </div>
        <div className="space-y-2">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="w-full h-10" />
            ))}
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between p-4 bg-white border-b dark:bg-slate-900 dark:border-slate-800">
          <Skeleton className="w-48 h-8" />
          <div className="flex items-center space-x-4">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="hidden w-24 h-6 md:block" />
          </div>
        </div>
        <div className="p-4 md:p-6">
          <div className="space-y-4">
            <Skeleton className="w-full h-10" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Array(4)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="w-full h-32" />
                ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {Array(2)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="w-full h-64" />
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
