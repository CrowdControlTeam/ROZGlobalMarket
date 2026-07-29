"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { reserveListing } from "@/lib/listings";
import { buttonClass, inputClass, labelClass } from "@/lib/ui";
import { formatPrice, priceColorClass } from "@/lib/price";
import { getErrorMessage } from "@/lib/errors";

// Reserva de una venta a precio fijo: crea un Deal PENDING que retiene stock
// hasta que el vendedor lo confirma o rechaza (ver reserveListing en
// listings.ts). Sustituye a la compra instantánea (BuyForm).
export function ReserveForm({
  listingId,
  available,
  unitPrice,
}: {
  listingId: string;
  available: number | null; // null = ilimitado ("los que tengas"): sin tope
  unitPrice: number;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("market.detail.reserve");
  // Mismo guard que el resto de formularios contra el mash-click (ver
  // NewPublicationForm.tsx).
  const submittingRef = useRef(false);

  return (
    <form
      action={(formData) => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setError(null);
        startTransition(async () => {
          try {
            await reserveListing(listingId, formData);
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
        {isPending ? t("reserving") : t("submit")}
      </button>
    </form>
  );
}
