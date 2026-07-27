import { GiftsHistorySkeleton } from "@/components/GiftsHistorySkeleton";

// Sin <main>/título propios: my/layout.tsx (BackLink + título + pestañas)
// ya los pinta; esto solo cubre el contenido de la pestaña.
export default function Loading() {
  return <GiftsHistorySkeleton />;
}
