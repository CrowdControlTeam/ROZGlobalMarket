import { Skeleton } from "@/components/Skeleton";

function PanelSkeleton({ className, rows = 3 }: { className?: string; rows?: number }) {
  return (
    <div className={`rounded-lg border-4 border-ro-panel-border bg-ro-panel p-4 ${className ?? ""}`}>
      <Skeleton className="mb-3 h-4 w-32" />
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <>
      {/* El <main> + hub los pinta el layout de /market. Solo el selector de
          periodo (derecha) + los paneles. */}
      <div className="mb-4 flex justify-end">
        <Skeleton className="h-8 w-32" />
      </div>
      <PanelSkeleton className="mb-6" rows={1} />
      <PanelSkeleton className="mb-6" rows={4} />
      <PanelSkeleton className="mb-6" rows={1} />
      <PanelSkeleton className="mb-6" rows={5} />
      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={4} />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={4} />
      </div>
    </>
  );
}
