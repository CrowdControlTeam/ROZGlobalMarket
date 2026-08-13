"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// Enlace que abre el detalle de un listing en el DRAWER (@detail vía ?listing=)
// sobre la pantalla actual, preservando ruta y filtros, en vez de navegar a la
// página completa /market/[id]. Mismo patrón que las tarjetas del índice del
// mercado (ver listingHref en MarketResults). Al cerrar el drawer se vuelve a
// donde estabas, sin el "Volver al mercado". Lo usan las listas de Mi Actividad.
//
// replace: si ya hay un detalle abierto (?listing en la URL), abrir otro lo
// REEMPLAZA en el historial para que la ✕ cierre a la pantalla y no vaya
// saltando por los detalles vistos.
export function ListingLink({
  listingId,
  className,
  children,
}: {
  listingId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  const detailOpen = params.has("listing");
  params.set("listing", listingId);

  return (
    <Link href={`${pathname}?${params.toString()}`} replace={detailOpen} className={className}>
      {children}
    </Link>
  );
}
