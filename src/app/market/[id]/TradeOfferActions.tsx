"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { acceptTradeOffer, rejectTradeOffer, cancelTradeOffer } from "@/lib/trade-offers";
import { buttonClass } from "@/lib/ui";
import { getErrorMessage } from "@/lib/errors";
import { useListingSync } from "../listingStore";
import type { ListingCardPatch } from "@/lib/listing-card";

export function TradeOfferActions({
  offerId,
  role,
}: {
  offerId: string;
  role: "seller" | "offerer";
}) {
  const sync = useListingSync();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("market.detail.tradeActions");

  function run(action: (id: string) => Promise<ListingCardPatch>) {
    setError(null);
    startTransition(async () => {
      try {
        sync(await action(offerId));
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
              onClick={() => run(acceptTradeOffer)}
              className={buttonClass("primary")}
            >
              {t("accept")}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(rejectTradeOffer)}
              className={buttonClass("outline")}
            >
              {t("reject")}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(cancelTradeOffer)}
            className={buttonClass("outline")}
          >
            {t("cancelOffer")}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
