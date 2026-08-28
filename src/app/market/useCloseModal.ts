"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Query params que abren un modal del mercado sobre /market (parallel routes):
// publicar/editar/republicar y el panel de detalle.
const MODAL_PARAMS = ["publish", "edit", "repost", "listing"] as const;

// Cierra un modal del mercado quitando su query param de la URL ACTUAL, en vez de
// `router.back()`. Así el cierre es predecible: siempre te deja en la misma
// página con los filtros intactos, sin depender del historial — no te manda a una
// página inesperada (p. ej. si abriste el modal desde "Mi actividad") ni fuera de
// la app (si llegaste por enlace directo o refrescaste con el modal abierto).
// `replace` para que "atrás" no vuelva a abrir el modal.
export function useCloseModal(): () => void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return () => {
    const params = new URLSearchParams(searchParams);
    for (const p of MODAL_PARAMS) params.delete(p);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };
}
