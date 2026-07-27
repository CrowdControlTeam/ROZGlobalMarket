import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <Skeleton className="mb-3 h-4 w-32" />
      <div className="overflow-hidden rounded-lg border-4 border-ro-panel-border bg-ro-panel">
        <div className="border-b-4 border-ro-panel-border bg-ro-panel-header px-4 py-2">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex flex-col gap-4 p-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </main>
  );
}
