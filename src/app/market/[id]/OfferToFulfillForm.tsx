"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { offerToFulfill } from "@/lib/listings";
import { buttonClass, inputClass, labelClass } from "@/lib/ui";
import { formatPrice, priceColorClass } from "@/lib/price";
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
}: {
  listingId: string;
  available: number | null; // null = compra ilimitada ("los que tengas")
  unitPrice: number | null; // null = "sin precio" (competitivo): el vendedor pide
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [ask, setAsk] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("market.detail.fulfillForm");
  const submittingRef = useRef(false);

  const competitive = unitPrice === null;
  const effectiveUnit = competitive ? ask : unitPrice;

  return (
    <form
      action={(formData) => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setError(null);
        startTransition(async () => {
          try {
            await offerToFulfill(listingId, formData);
            router.refresh();
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
        <input
          type="number"
          name="quantity"
          min={1}
          max={available ?? undefined}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className={inputClass}
        />
      </div>

      {competitive && (
        <div>
          <label className={labelClass}>{t("askLabel")}</label>
          <input
            type="number"
            name="price"
            min={1}
            value={ask}
            onChange={(e) => setAsk(Number(e.target.value))}
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
        {isPending ? t("offering") : t("submit")}
      </button>
    </form>
  );
}
