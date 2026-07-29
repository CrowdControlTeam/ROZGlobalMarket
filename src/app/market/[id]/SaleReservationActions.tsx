"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  acceptSaleReservation,
  rejectSaleReservation,
  cancelSaleReservation,
} from "@/lib/listings";
import { buttonClass } from "@/lib/ui";
import { getErrorMessage } from "@/lib/errors";

// Acciones sobre una reserva de venta: el vendedor confirma/rechaza; el
// comprador cancela la suya. Mismo patrón que TradeOfferActions.
export function SaleReservationActions({
  dealId,
  role,
}: {
  dealId: string;
  role: "seller" | "buyer";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("market.detail.reservationActions");

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
        {role === "seller" ? (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(acceptSaleReservation)}
              className={buttonClass("primary")}
            >
              {t("confirm")}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(rejectSaleReservation)}
              className={buttonClass("outline")}
            >
              {t("reject")}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(cancelSaleReservation)}
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
