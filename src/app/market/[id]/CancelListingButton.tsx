"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cancelListing, fulfillListing } from "@/lib/listings";
import { buttonClass } from "@/lib/ui";
import { getErrorMessage } from "@/lib/errors";

// showFulfill: solo type=BUY (norma 2.4 del plan original) — la resolución de una
// petición de compra pasa fuera de la app, quien la publicó la marca
// cumplida a mano.
export function CancelListingButton({
  listingId,
  showFulfill = false,
}: {
  listingId: string;
  showFulfill?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("market.detail");

  function run(action: (id: string) => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action(listingId);
        router.refresh();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        {showFulfill && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(fulfillListing)}
            className={buttonClass("primary")}
          >
            {t("markFulfilled")}
          </button>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(cancelListing)}
          className={buttonClass("outline")}
        >
          {t("cancelListing")}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
