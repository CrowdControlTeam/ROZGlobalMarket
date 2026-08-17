"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { offerToFulfill } from "@/lib/listings";
import { useListingSync } from "../listingStore";
import { buttonClass } from "@/lib/ui";
import { FloatingField, floatingControlClass } from "@/components/FloatingField";
import { formatPrice, priceColorClass } from "@/lib/price";
import { MaskedPriceInput } from "@/components/MaskedPriceInput";
import { getErrorMessage } from "@/lib/errors";

// Vendedor que se ofrece a cumplir una petición de compra (BUY):
//  - precio fijo (unitPrice number): oferta al precio del comprador; Deal PENDING
//    que retiene cupo hasta que el comprador confirma/rechaza.
//  - "sin precio" (unitPrice null, competitivo): el vendedor PIDE su precio/ud; la
//    oferta no retiene cupo y el comprador elige la más barata (ver offerToFulfill).
export function OfferToFulfillForm({
  listingId,
  available,
  unitPrice,
  suggestedAsk,
}: {
  listingId: string;
  available: number | null; // null = compra ilimitada ("los que tengas")
  unitPrice: number | null; // null = "sin precio" (competitivo): el vendedor pide
  suggestedAsk: number | null; // mejor oferta actual (competitivo) para prefijar; null = sin ninguna
}) {
  const sync = useListingSync();
  // Por defecto se vende todo lo pedido (1 si es ilimitado) y, en competitivo,
  // se pide la mejor oferta actual (1 si aún no hay ninguna).
  const [quantity, setQuantity] = useState(available ?? 1);
  const [ask, setAsk] = useState<number | "">(suggestedAsk ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("market.detail.fulfillForm");
  const submittingRef = useRef(false);

  const competitive = unitPrice === null;
  const effectiveUnit = competitive ? (ask === "" ? 0 : ask) : unitPrice;

  return (
    <form
      action={(formData) => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setError(null);
        startTransition(async () => {
          try {
            sync(await offerToFulfill(listingId, formData));
          } catch (err) {
            setError(getErrorMessage(err));
          } finally {
            submittingRef.current = false;
          }
        });
      }}
      className="flex flex-col gap-3"
    >
      {/* Cantidad y precio pedido en la MISMA fila (cantidad × precio); el
          total va destacado debajo. En precio fijo solo hay cantidad. */}
      <div className="flex gap-3">
        <FloatingField label={t("quantityLabel")} className="flex-1">
          {/* Con 1 sola unidad el input no aporta: "1" en texto plano (con la
              etiqueta flotante arriba) + hidden. */}
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
          <FloatingField label={t("askLabel")} className="flex-1">
            {/* Máscara de miles + color por tramo (ver MaskedPriceInput); el
                valor crudo viaja por el input oculto. */}
            <MaskedPriceInput value={ask} onChange={setAsk} className={floatingControlClass} />
            <input type="hidden" name="price" value={ask} />
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
        {isPending ? t("offering") : t("submit")}
      </button>
    </form>
  );
}
