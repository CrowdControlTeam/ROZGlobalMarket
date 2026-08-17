"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/lib/ui";
import { useListingActions } from "../useListingActions";

// Botón "Republicar" de la ficha del listing (poster, publicación NO activa).
// Abre el modal de publicar con los datos precargados para crear una nueva. Sin
// validación (a diferencia de Editar): siempre disponible.
export function RepostListingButton({ listingId }: { listingId: string }) {
  const t = useTranslations("market");
  const { repost } = useListingActions(listingId);
  return (
    <button type="button" onClick={repost} className={buttonClass("secondary")}>
      <RefreshCw size={15} aria-hidden />
      {t("card.repost")}
    </button>
  );
}
