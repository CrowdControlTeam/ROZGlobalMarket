"use client";

import { Pencil, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { KebabMenu, type KebabItem } from "@/components/KebabMenu";
import { Toast } from "@/components/Toast";
import { useListingActions } from "../../useListingActions";

// Kebab (⋮) de una publicación propia en "Mis publicaciones":
//  - Activa → "Editar" (misma regla que la card del mercado: navega al modal
//    @edit si es editable —sin ofertas/ventas vivas—, si no avisa por Toast).
//  - No activa → "Republicar" (abre el modal de publicar con los datos
//    precargados para crear una nueva). Aquí caben acciones futuras.
export function MyListingActions({
  listingId,
  active,
  canEdit,
}: {
  listingId: string;
  active: boolean;
  canEdit: boolean;
}) {
  const t = useTranslations("market");
  const { tryEdit, repost, warning, dismissWarning } = useListingActions(listingId, canEdit);
  const items: KebabItem[] = active
    ? [{ label: t("card.edit"), icon: <Pencil size={14} aria-hidden />, onSelect: tryEdit }]
    : [{ label: t("card.repost"), icon: <RefreshCw size={14} aria-hidden />, onSelect: repost }];
  return (
    <>
      <KebabMenu label={t("card.menu")} items={items} />
      {warning && <Toast message={warning} onDismiss={dismissWarning} />}
    </>
  );
}
