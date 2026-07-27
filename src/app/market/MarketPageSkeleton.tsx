import { Skeleton } from "@/components/Skeleton";
import { MarketResultsSkeleton } from "./MarketResultsSkeleton";

// loading.tsx de /market, /market/sale, /market/buy y /market/trade (cada
// una es un route segment distinto pese a compartir MarketPageContent) —
// cubre el tramo brevísimo antes de que el propio <Suspense> interno de
// la página tome el relevo. Imita el alto del título + panel de filtros +
// selector de orden reales para no dar salto de layout.
export function MarketPageSkeleton() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Skeleton className="mb-6 h-6 w-40" />
      <div className="mb-4 rounded-lg border-4 border-ro-panel-border bg-ro-panel p-4">
        <Skeleton className="h-8 w-full" />
      </div>
      <Skeleton className="mb-4 ml-auto h-8 w-40" />
      <MarketResultsSkeleton />
    </main>
  );
}
