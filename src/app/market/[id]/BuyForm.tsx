"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { purchaseListing } from "@/lib/listings";
import { buttonClass, inputClass, labelClass } from "@/lib/ui";
import { formatPrice, priceColorClass } from "@/lib/price";
import { getErrorMessage } from "@/lib/errors";

export function BuyForm({
  listingId,
  remaining,
  unitPrice,
}: {
  listingId: string;
  remaining: number;
  unitPrice: number;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("market.detail.buy");
  // useTransition por sí solo no basta: disabled={isPending} solo se
  // refleja en el DOM tras el siguiente render, y clics muy seguidos
  // pueden dispararse antes de ese commit — ver NewPublicationForm.tsx.
  const submittingRef = useRef(false);

  return (
    <form
      action={(formData) => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setError(null);
        startTransition(async () => {
          try {
            await purchaseListing(listingId, formData);
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
          max={remaining}
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
        {isPending ? t("buying") : t("submit")}
      </button>
    </form>
  );
}
