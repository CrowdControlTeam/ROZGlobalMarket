import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <Skeleton className="mb-3 h-4 w-32" />
      <div className="overflow-hidden rounded-lg border-4 border-ro-panel-border bg-ro-panel">
        <div className="flex items-center justify-between border-b-4 border-ro-panel-border bg-ro-panel-header px-4 py-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="flex flex-col gap-6 p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
