"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { claimGift } from "@/lib/gifts";
import { buttonClass, inputClass, labelClass } from "@/lib/ui";
import { getErrorMessage } from "@/lib/errors";

// Reclamar un regalo reclamable (sin destinatario): crea un Deal PENDING que
// retiene unidades hasta que el que regala lo confirma o rechaza (ver claimGift
// en gifts.ts). Como una reserva de venta pero gratis (sin precio ni total).
export function ClaimGiftForm({
  listingId,
  available,
}: {
  listingId: string;
  // Un GIFT siempre tiene tope; el null solo existe por el tipo compartido con
  // el resto de forms (SALE/BUY sí pueden ser ilimitados).
  available: number | null;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("market.detail.claimForm");
  const submittingRef = useRef(false);

  return (
    <form
      action={(formData) => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setError(null);
        startTransition(async () => {
          try {
            await claimGift(listingId, formData);
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
      {available !== null && available > 1 ? (
        <div>
          <label className={labelClass}>{t("quantityLabel")}</label>
          <input
            type="number"
            name="quantity"
            min={1}
            max={available}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className={inputClass}
          />
        </div>
      ) : (
        <input type="hidden" name="quantity" value={1} />
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={isPending} className={buttonClass("primary")}>
        {isPending ? t("claiming") : t("submit")}
      </button>
    </form>
  );
}
