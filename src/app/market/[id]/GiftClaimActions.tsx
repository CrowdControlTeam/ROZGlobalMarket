"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { acceptGiftClaim, rejectGiftClaim, cancelGiftClaim } from "@/lib/gifts";
import { buttonClass } from "@/lib/ui";
import { getErrorMessage } from "@/lib/errors";

// Acciones sobre una reclamación de regalo: el que regala entrega/rechaza; el
// reclamante cancela la suya. Mismo patrón que SaleReservationActions.
export function GiftClaimActions({
  dealId,
  role,
}: {
  dealId: string;
  role: "giver" | "claimer";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("market.detail.claimActions");

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
        {role === "giver" ? (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(acceptGiftClaim)}
              className={buttonClass("primary")}
            >
              {t("confirm")}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(rejectGiftClaim)}
              className={buttonClass("outline")}
            >
              {t("reject")}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(cancelGiftClaim)}
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
