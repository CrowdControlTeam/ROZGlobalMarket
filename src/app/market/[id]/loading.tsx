import { Skeleton } from "@/components/Skeleton";

// Imita la forma real de market/[id]/page.tsx (BackLink + Panel con
// icono/nombre, grid de stats, options) para no dar salto de layout.
export default function Loading() {
  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <Skeleton className="mb-3 h-4 w-32" />
      <div className="rounded-lg border-4 border-ro-panel-border bg-ro-panel p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-4 h-9 w-full" />
      </div>
    </main>
  );
}
