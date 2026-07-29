"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  acceptFulfillOffer,
  rejectFulfillOffer,
  cancelFulfillOffer,
} from "@/lib/listings";
import { buttonClass } from "@/lib/ui";
import { getErrorMessage } from "@/lib/errors";

// Acciones sobre una oferta de venta a una petición de compra: el comprador
// (poster) confirma/rechaza; el vendedor cancela la suya. Mismo patrón que
// SaleReservationActions / TradeOfferActions.
export function BuyOfferActions({
  dealId,
  role,
}: {
  dealId: string;
  role: "buyer" | "seller";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("market.detail.fulfillActions");

  function run(action: (id: string) => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action(dealId);
        router.refresh();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        {role === "buyer" ? (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(acceptFulfillOffer)}
              className={buttonClass("primary")}
            >
              {t("confirm")}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(rejectFulfillOffer)}
              className={buttonClass("outline")}
            >
              {t("reject")}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(cancelFulfillOffer)}
            className={buttonClass("outline")}
          >
            {t("cancel")}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
