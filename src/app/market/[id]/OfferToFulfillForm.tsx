"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { offerToFulfill } from "@/lib/listings";
import { buttonClass, inputClass, labelClass } from "@/lib/ui";
import { formatPrice, priceColorClass } from "@/lib/price";
import { getErrorMessage } from "@/lib/errors";

// Oferta de un vendedor para cumplir una petición de compra (BUY) a precio
// fijo: crea un Deal PENDING que el comprador (poster) confirma o rechaza (ver
// offerToFulfill en listings.ts). Espejo de ReserveForm con los roles
// invertidos: aquí el que actúa es el vendedor y "recibirá" el importe.
export function OfferToFulfillForm({
  listingId,
  available,
  unitPrice,
}: {
  listingId: string;
  available: number | null; // null = compra ilimitada ("los que tengas")
  unitPrice: number;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("market.detail.fulfillForm");
  const submittingRef = useRef(false);

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

      <p className="text-sm text-ro-text-muted">
        {t("total")}{" "}
        <span className={`font-semibold ${priceColorClass(quantity * unitPrice)}`}>
          {formatPrice(quantity * unitPrice)}
        </span>
      </p>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={isPending} className={buttonClass("primary")}>
        {isPending ? t("offering") : t("submit")}
      </button>
    </form>
  );
}
