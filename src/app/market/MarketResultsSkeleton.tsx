import { Skeleton } from "@/components/Skeleton";

// Imita la fila real de MarketResults (icono + texto + precio dentro de
// una tarjeta con borde) para que no haya salto de layout al sustituirse
// por los listings reales.
export function MarketResultsSkeleton() {
  return (
    <>
      {/* Cabecera de resultados (contador + orden + vista). */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-40" />
      </div>
      <ul className="flex flex-col gap-3">
      {Array.from({ length: 6 }, (_, i) => (
        <li
          key={i}
          className="flex items-center gap-4 rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4"
        >
          <Skeleton className="h-10 w-10 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-16" />
        </li>
      ))}
      </ul>
    </>
  );
}
