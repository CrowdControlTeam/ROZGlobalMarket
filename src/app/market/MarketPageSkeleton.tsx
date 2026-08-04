import { Skeleton } from "@/components/Skeleton";
import { MarketResultsSkeleton } from "./MarketResultsSkeleton";

// loading.tsx de /market — cubre el tramo brevísimo antes de que el propio
// <Suspense> interno de la página tome el relevo. Imita el alto del título +
// panel de filtros + selector de orden reales para no dar salto de layout.
export function MarketPageSkeleton() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Skeleton className="mb-4 h-7 w-40" />
      {/* Selector de tipo (5 pills). */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="mb-4 rounded-lg border-4 border-ro-panel-border bg-ro-panel p-4">
        <Skeleton className="h-8 w-full" />
      </div>
      <MarketResultsSkeleton />
    </main>
  );
}
