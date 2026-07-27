// Bloque base de placeholder mientras carga contenido real (usado dentro
// de los loading.tsx/<Suspense> de cada ruta) — un div con animación de
// pulso, sin texto ni forma propia; cada sitio que lo usa le da el
// ancho/alto/redondeo que necesite via className para imitar la forma del
// contenido real y no producir salto de layout al sustituirse.
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-ro-panel-border/30 ${className ?? ""}`} />;
}
