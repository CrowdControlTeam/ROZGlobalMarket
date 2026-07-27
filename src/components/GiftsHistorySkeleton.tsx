import { Skeleton } from "@/components/Skeleton";

// Imita la fila real de GiftsHistory (icono de dirección + icono de item +
// texto), usado en /market/gifts y /my/gifts.
export function GiftsHistorySkeleton() {
  return (
    <ul className="flex flex-col gap-3">
      {Array.from({ length: 5 }, (_, i) => (
        <li
          key={i}
          className="flex items-center gap-4 rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4"
        >
          <Skeleton className="h-5 w-5 shrink-0" />
          <Skeleton className="h-10 w-10 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-16" />
        </li>
      ))}
    </ul>
  );
}
