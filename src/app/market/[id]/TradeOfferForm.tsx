"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createTradeOffer } from "@/lib/trade-offers";
import { getMaxRefineLevel } from "@/lib/listings";
import { buttonClass, inputClass, labelClass } from "@/lib/ui";
import { isRefineEligible, DEFAULT_MAX_REFINE_LEVEL } from "@/lib/refine-constants";
import { getMaxCardSlots } from "@/lib/card-slots-constants";
import { getErrorMessage } from "@/lib/errors";
import { ItemPicker, type ItemResult } from "../new/ItemPicker";

export function TradeOfferForm({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<ItemResult | null>(null);
  const [refineLevel, setRefineLevel] = useState(0);
  const [cardSlots, setCardSlots] = useState(0);
  const [maxRefineLevel, setMaxRefineLevel] = useState(DEFAULT_MAX_REFINE_LEVEL);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // useTransition por sí solo no basta: disabled={isPending} solo se
  // refleja en el DOM tras el siguiente render, y clics muy seguidos
  // pueden dispararse antes de ese commit — ver NewPublicationForm.tsx.
  const submittingRef = useRef(false);
  const t = useTranslations("market.detail.tradeForm");
  const tField = useTranslations("market.field");
  const tStatus = useTranslations("market.status");

  useEffect(() => {
    getMaxRefineLevel().then(setMaxRefineLevel);
  }, []);

  const refineEligible = selectedItem !== null && isRefineEligible(selectedItem);
  const maxCardSlots = selectedItem !== null ? getMaxCardSlots(selectedItem) : 0;

  function handleItemSelect(item: ItemResult) {
    setSelectedItem(item);
    setRefineLevel(0);
    setCardSlots(0);
  }

  function handleItemClear() {
    setSelectedItem(null);
    setRefineLevel(0);
    setCardSlots(0);
  }

  return (
    <form
      action={(formData) => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setError(null);
        startTransition(async () => {
          try {
            await createTradeOffer(listingId, formData);
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
        <label className={labelClass}>{t("offerItem")}</label>
        <ItemPicker selected={selectedItem} onSelect={handleItemSelect} onClear={handleItemClear} />
        <input type="hidden" name="itemId" value={selectedItem?.id ?? ""} />
      </div>

      <div>
        <label className={labelClass}>{tField("quantity")}</label>
        <input type="number" name="quantity" min={1} defaultValue={1} required className={inputClass} />
      </div>

      {refineEligible && (
        <div>
          <label className={labelClass}>{tField("refine")}</label>
          <input
            type="number"
            name="refineLevel"
            min={0}
            max={maxRefineLevel}
            value={refineLevel}
            onChange={(e) => setRefineLevel(e.target.value === "" ? 0 : Number(e.target.value))}
            className={inputClass}
          />
        </div>
      )}

      {maxCardSlots > 0 && (
        <div>
          <label className={labelClass}>{tField("cardSlots")}</label>
          <input
            type="number"
            name="cardSlots"
            min={0}
            max={maxCardSlots}
            value={cardSlots}
            onChange={(e) => setCardSlots(e.target.value === "" ? 0 : Number(e.target.value))}
            className={inputClass}
          />
        </div>
      )}

      <div>
        <label className={labelClass}>{t("zeny")}</label>
        <input type="number" name="zenyOffered" min={0} defaultValue={0} className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={!selectedItem || isPending} className={buttonClass("primary")}>
        {isPending ? tStatus("sending") : t("submit")}
      </button>
    </form>
  );
}
