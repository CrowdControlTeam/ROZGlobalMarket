"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { reserveListing } from "@/lib/listings";
import { useListingSync } from "../listingStore";
import { buttonClass, inputClass, labelClass } from "@/lib/ui";
import { formatPrice, priceColorClass } from "@/lib/price";
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
  const [bid, setBid] = useState(suggestedBid ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("market.detail.reserve");
  // Mismo guard que el resto de formularios contra el mash-click (ver
  // NewPublicationForm.tsx).
  const submittingRef = useRef(false);

  const competitive = unitPrice === null;
  const effectiveUnit = competitive ? bid : unitPrice;

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
      <div>
        <label className={labelClass}>{t("quantityLabel")}</label>
        {/* Con 1 sola unidad disponible el input no aporta: se muestra "1" en
            texto plano (se mantiene la fila por armonía) y se envía por hidden. */}
        {available === 1 ? (
          <>
            <p className="text-sm text-ro-text-muted">1</p>
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
            className={inputClass}
          />
        )}
      </div>

      {competitive && (
        <div>
          <label className={labelClass}>{t("bidLabel")}</label>
          <input
            type="number"
            name="price"
            min={1}
            value={bid}
            onChange={(e) => setBid(Number(e.target.value))}
            className={inputClass}
          />
        </div>
      )}

      <p className="text-sm text-ro-text-muted">
        {t("total")}{" "}
        <span className={`font-semibold ${priceColorClass(quantity * effectiveUnit)}`}>
          {formatPrice(quantity * effectiveUnit)}
        </span>
      </p>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={isPending} className={buttonClass("primary")}>
        {isPending ? t("reserving") : t("submit")}
      </button>
    </form>
  );
}
