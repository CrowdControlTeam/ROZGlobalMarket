"use client";

import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/lib/ui";
import { useListingActions } from "../useListingActions";

// Botón "Editar" de la ficha del listing (solo para el poster y en ACTIVE). Se
// DESHABILITA cuando la publicación tiene ofertas/ventas vivas (no editable),
// igual que Cancelar cuando hay ofertas pendientes: el title va en un <span>
// envolvente (un botón deshabilitado no recibe eventos de puntero, así que su
// propio title no se mostraría) + una explicación debajo (order-last + w-full,
// misma fila propia que la del cancelar). Enabled abre el modal @edit.
export function EditListingButton({ listingId, canEdit }: { listingId: string; canEdit: boolean }) {
  const t = useTranslations("market");
  const { tryEdit } = useListingActions(listingId, canEdit);
  return (
    <>
      <span className="inline-block" title={canEdit ? undefined : t("card.editBlocked")}>
        <button
          type="button"
          disabled={!canEdit}
          onClick={tryEdit}
          className={buttonClass("outline")}
        >
          <Pencil size={15} aria-hidden />
          {t("card.edit")}
        </button>
      </span>
      {!canEdit && (
        <p className="order-last w-full text-sm text-ro-text-muted">{t("card.editBlocked")}</p>
      )}
    </>
  );
}
