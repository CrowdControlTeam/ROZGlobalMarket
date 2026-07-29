import { Skeleton } from "@/components/Skeleton";

// Sin <main>/título propios: my/layout.tsx ya los pinta.
export default function Loading() {
  return (
    <ul className="flex flex-col gap-3">
      {Array.from({ length: 4 }, (_, i) => (
        <li
          key={i}
          className="flex items-center gap-4 rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4"
        >
          <Skeleton className="h-10 w-10 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-24" />
        </li>
      ))}
    </ul>
  );
}
