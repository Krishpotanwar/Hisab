import { Skeleton } from "@/components/ui/skeleton";

export function GroupDetailSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container max-w-2xl mx-auto px-4 pb-4 pt-[calc(1rem+var(--safe-area-top))] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 pb-[calc(6rem+var(--safe-area-bottom))] space-y-6">
        <Skeleton className="h-28 w-full rounded-2xl" />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={`member-skeleton-${index}`} className="h-12 w-12 rounded-full flex-shrink-0" />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={`balance-skeleton-${index}`} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`expense-skeleton-${index}`} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
