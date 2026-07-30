"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { cancelListing } from "@/lib/listings";
import { useListingSync } from "../listingStore";
import { buttonClass } from "@/lib/ui";
import { getErrorMessage } from "@/lib/errors";

// Cierre a mano de la publicación (SALE o BUY), único botón para el poster:
//  - con tope: cerrarlo = "Cancelar" (si siguiera activo es que no se alcanzó la
//    cantidad; al alcanzarla pasa a COMPLETED solo) → CANCELLED.
//  - ilimitado: "Cerrar" → COMPLETED si se comerció algo, CANCELLED si no.
// La regla de estado vive en cancelListing (listings.ts); aquí solo cambia el
// texto según `unlimited`.
export function CancelListingButton({
  listingId,
  unlimited = false,
}: {
  listingId: string;
  unlimited?: boolean;
}) {
  const sync = useListingSync();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("market.detail");

  function close() {
    setError(null);
    startTransition(async () => {
      try {
        sync(await cancelListing(listingId));
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={close}
        className={buttonClass("outline")}
      >
        {unlimited ? t("closeListing") : t("cancelListing")}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
