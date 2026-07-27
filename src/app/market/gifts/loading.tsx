import { Skeleton } from "@/components/Skeleton";
import { GiftsHistorySkeleton } from "@/components/GiftsHistorySkeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Skeleton className="mb-6 h-6 w-32" />
      <GiftsHistorySkeleton />
    </main>
  );
}
