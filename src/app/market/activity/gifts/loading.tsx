import { GiftsHistorySkeleton } from "@/components/GiftsHistorySkeleton";

// Sin <main>/hub/pestañas propios: los pintan el layout de /market (contenedor +
// hub) y activity/layout (pestañas); esto solo cubre el contenido de la pestaña.
export default function Loading() {
  return <GiftsHistorySkeleton />;
}
