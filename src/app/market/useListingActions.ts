"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

// Acciones de una publicación propia fuera del grid del mercado (detalle del
// listing y "Mis publicaciones"): abren el modal correspondiente reutilizando los
// slots paralelos por query param. La card del mercado tiene su propia versión
// inline; aquí se centraliza para no duplicarla en cada entrada.
//  - Editar (?edit=): solo si es editable (del usuario y SIN deals vivos); si no,
//    no navega y deja un aviso para mostrarlo en un Toast. Regla y validación
//    autoritativa en updateListing.
//  - Republicar (?repost=): crea una publicación NUEVA con los datos precargados
//    (mismo modal de publicar). Sin gate: se ofrece en las publicaciones NO
//    activas.
// Ambos parámetros abren su modal en cualquier subruta de /market (catch-all de
// cada slot); se limpian ?listing/?edit/?repost para no apilar modales.
export function useListingActions(listingId: string, canEdit = false) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("market");
  const [warning, setWarning] = useState<string | null>(null);

  function hrefWith(param: "edit" | "repost") {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("listing");
    params.delete("edit");
    params.delete("repost");
    params.set(param, listingId);
    return `${pathname}?${params.toString()}`;
  }

  function tryEdit() {
    if (!canEdit) {
      setWarning(t("card.editBlocked"));
      return;
    }
    router.push(hrefWith("edit"));
  }

  function repost() {
    router.push(hrefWith("repost"));
  }

  return { tryEdit, repost, warning, dismissWarning: () => setWarning(null) };
}
