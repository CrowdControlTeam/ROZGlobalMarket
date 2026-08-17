"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { reserveListing } from "@/lib/listings";
import { useListingSync } from "../listingStore";
import { buttonClass } from "@/lib/ui";
import { FloatingField, floatingControlClass } from "@/components/FloatingField";
import { formatPrice, priceColorClass } from "@/lib/price";
import { MaskedPriceInput } from "@/components/MaskedPriceInput";
import { getErrorMessage } from "@/lib/errors";

// Comprador sobre una venta:
//  - precio fijo (unitPrice number): reserva a ese precio; crea un Deal PENDING
//    que retiene stock hasta que el vendedor confirma/rechaza.
//  - "sin precio" (unitPrice null, competitivo): el comprador PUJA su precio/ud;
//    la puja no retiene stock y el vendedor elige la mejor (ver reserveListing).
export function ReserveForm({
  listingId,
  available,
  unitPrice,
  suggestedBid,
}: {
  listingId: string;
  available: number | null; // null = ilimitado ("los que tengas"): sin tope
  unitPrice: number | null; // null = "sin precio" (competitivo): el comprador puja
  suggestedBid: number | null; // mejor puja actual (competitivo) para prefijar; null = sin ninguna
}) {
  const sync = useListingSync();
  // Por defecto se compra todo lo disponible (1 si es ilimitado) y, en
  // competitivo, se puja la mejor oferta actual (1 si aún no hay ninguna).
  const [quantity, setQuantity] = useState(available ?? 1);
  const [bid, setBid] = useState<number | "">(suggestedBid ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("market.detail.reserve");
  // Mismo guard que el resto de formularios contra el mash-click (ver
  // PublishForm.tsx).
  const submittingRef = useRef(false);

  const competitive = unitPrice === null;
  const effectiveUnit = competitive ? (bid === "" ? 0 : bid) : unitPrice;

  return (
    <form
      action={(formData) => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setError(null);
        startTransition(async () => {
          try {
            sync(await reserveListing(listingId, formData));
          } catch (err) {
            setError(getErrorMessage(err));
          } finally {
            submittingRef.current = false;
          }
        });
      }}
      className="flex flex-col gap-3"
    >
      {/* Cantidad y oferta en la MISMA fila (cantidad × precio); el total,
          resultado, va destacado debajo. En precio fijo solo hay cantidad, que
          ocupa la fila entera. */}
      <div className="flex gap-3">
        <FloatingField label={t("quantityLabel")} className="flex-1">
          {/* Con 1 sola unidad disponible el input no aporta: se muestra "1" en
              texto plano (con la etiqueta flotante arriba) y se envía por hidden. */}
          {available === 1 ? (
            <>
              <span className="text-sm text-ro-text-muted">1</span>
              <input type="hidden" name="quantity" value={1} />
            </>
          ) : (
            <input
              type="number"
              name="quantity"
              min={1}
              max={available ?? undefined}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className={floatingControlClass}
            />
          )}
        </FloatingField>

        {competitive && (
          <FloatingField label={t("bidLabel")} className="flex-1">
            {/* Máscara de miles + color por tramo mientras se escribe (ver
                MaskedPriceInput); el valor crudo viaja por el input oculto. */}
            <MaskedPriceInput value={bid} onChange={setBid} className={floatingControlClass} />
            <input type="hidden" name="price" value={bid} />
          </FloatingField>
        )}
      </div>

      <div className="flex items-baseline justify-between border-t border-ro-panel-border/60 pt-3">
        <span className="text-sm text-ro-text-muted">{t("total")}</span>
        <span className={`text-lg font-bold ${priceColorClass(quantity * effectiveUnit)}`}>
          {formatPrice(quantity * effectiveUnit)}
        </span>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={isPending} className={buttonClass("primary")}>
        {isPending ? t("reserving") : t("submit")}
      </button>
    </form>
  );
}
