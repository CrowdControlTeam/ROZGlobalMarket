"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tag, ShoppingCart, ArrowLeftRight, Gift } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ItemOptionDef } from "@prisma/client";
import { createListing, getOptionChoices, getMaxRefineLevel } from "@/lib/listings";
import { sendGift } from "@/lib/gifts";
import { recognizeItemFromScreenshot } from "@/lib/item-recognition";
import { buttonClass, selectClass } from "@/lib/ui";
import { MaskedPriceInput } from "@/components/MaskedPriceInput";
import { FloatingField, floatingControlClass } from "@/components/FloatingField";
import {
  MAX_OPTION_SLOTS,
  emptyOptionSelections,
  buildOptionSelectionsFromDetected,
  type OptionSelection,
} from "@/lib/item-options-constants";
import { isRefineEligible, DEFAULT_MAX_REFINE_LEVEL } from "@/lib/refine-constants";
import { getMaxCardSlots } from "@/lib/card-slots-constants";
import { getErrorMessage, rethrowFrameworkErrors } from "@/lib/errors";
import { ItemPicker, type ItemResult } from "./new/ItemPicker";
import { ScreenshotDropzone } from "./new/ScreenshotDropzone";
import { UserPicker, type UserResult } from "@/components/UserPicker";
import type { PublicationType } from "./new/NewPublicationForm";

type TypeSegment = { value: PublicationType; Icon: LucideIcon; activeBg: string; iconColor: string };
const TYPE_SEGMENTS: TypeSegment[] = [
  { value: "SALE", Icon: Tag, activeBg: "bg-ro-type-sale", iconColor: "text-ro-type-sale" },
  { value: "BUY", Icon: ShoppingCart, activeBg: "bg-ro-type-buy", iconColor: "text-ro-type-buy" },
  { value: "TRADE", Icon: ArrowLeftRight, activeBg: "bg-ro-type-trade", iconColor: "text-ro-type-trade" },
  { value: "GIFT", Icon: Gift, activeBg: "bg-ro-type-gift", iconColor: "text-ro-type-gift" },
];

// Formulario de publicar del rediseño (2 columnas: escaneo · O · formulario).
// Reutiliza íntegra la lógica del NewPublicationForm de página; solo cambia la
// presentación (FloatingField + pestañas Info/Opciones). El contrato de FormData
// hacia createListing/sendGift es idéntico.
export function PublishForm({
  recognitionEnabled,
  initialType,
  onClose,
}: {
  recognitionEnabled: boolean;
  initialType: PublicationType;
  onClose: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<PublicationType>(initialType);
  const [selectedItem, setSelectedItem] = useState<ItemResult | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<UserResult | null>(null);
  const [optionDefs, setOptionDefs] = useState<ItemOptionDef[]>([]);
  const [optionSelections, setOptionSelections] = useState<OptionSelection[]>(emptyOptionSelections());
  const [refineLevel, setRefineLevel] = useState(0);
  const [cardSlots, setCardSlots] = useState(0);
  const [price, setPrice] = useState<number | "">("");
  const [unlimited, setUnlimited] = useState(false);
  const [noPrice, setNoPrice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceMissing, setPriceMissing] = useState(false);
  const [maxRefineLevel, setMaxRefineLevel] = useState(DEFAULT_MAX_REFINE_LEVEL);
  const [isRecognizing, startRecognizeTransition] = useTransition();
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [recognitionNote, setRecognitionNote] = useState<string | null>(null);
  const t = useTranslations("market.form");
  const tField = useTranslations("market.field");
  const tFilters = useTranslations("market.filters");
  const tCommon = useTranslations("common");

  useEffect(() => {
    getMaxRefineLevel().then(setMaxRefineLevel);
  }, []);

  const optionGroup = selectedItem?.optionGroup ?? null;
  const refineEligible = selectedItem !== null && isRefineEligible(selectedItem);
  const maxCardSlots = selectedItem !== null ? getMaxCardSlots(selectedItem) : 0;
  const quantityLocked = type === "TRADE" || ((type === "SALE" || type === "GIFT") && optionGroup !== null);
  const canBeUnlimited = !quantityLocked && (type === "SALE" || type === "BUY");
  const showPrice = type === "SALE" || type === "BUY";

  useEffect(() => {
    if (!optionGroup) return;
    getOptionChoices(optionGroup).then(setOptionDefs);
  }, [optionGroup]);

  const hasOptionCatalog = optionGroup !== null && optionDefs.length > 0;
  const optionsCount = optionSelections.filter((s) => s.defId !== "").length;

  function handleTypeChange(next: PublicationType) {
    setType(next);
    setOptionSelections(emptyOptionSelections());
  }

  function handleItemSelect(item: ItemResult) {
    setSelectedItem(item);
    setOptionSelections(emptyOptionSelections());
    setRefineLevel(0);
    setCardSlots(0);
    setRecognitionNote(null);
  }

  function handleItemClear() {
    setSelectedItem(null);
    setOptionSelections(emptyOptionSelections());
    setRefineLevel(0);
    setCardSlots(0);
    setRecognitionNote(null);
  }

  function handleScreenshotScan(file: File) {
    setRecognitionNote(null);
    startRecognizeTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("screenshot", file);
        const result = await recognizeItemFromScreenshot(formData);

        if (result.status === "error") {
          setRecognitionNote(result.message);
          return;
        }
        if (result.status === "no_match") {
          setRecognitionNote(
            result.detectedName
              ? t("recognitionNoMatchNamed", { name: result.detectedName })
              : t("recognitionNoMatch"),
          );
          return;
        }

        setSelectedItem(result.item);
        setRefineLevel(result.refineLevel);
        setCardSlots(result.cardSlots);
        setOptionSelections(buildOptionSelectionsFromDetected(result.options));
        setRecognitionNote(t("recognitionDetected", { item: result.item.name }));
      } catch (err) {
        rethrowFrameworkErrors(err);
        console.error(err);
        setRecognitionNote(t("recognitionCallFailed"));
      }
    });
  }

  function handleSelectChange(index: number, defId: string) {
    setOptionSelections((prev) => {
      const next = [...prev];
      if (!defId) {
        for (let i = index; i < next.length; i++) next[i] = { defId: "", value: "" };
        return next;
      }
      next[index] = { defId, value: "" };
      return next;
    });
  }

  function handleValueChange(index: number, value: number | "") {
    setOptionSelections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], value };
      return next;
    });
  }

  const canSubmit = selectedItem !== null;
  const submittingRef = useRef(false);

  return (
    <form
      onSubmit={(e) => {
        const priceRequired = showPrice && !noPrice;
        const priceEmpty = priceRequired && !new FormData(e.currentTarget).get("price");
        setPriceMissing(priceEmpty);
        if (priceEmpty) e.preventDefault();
      }}
      action={(formData) => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setError(null);
        startSubmitTransition(async () => {
          try {
            if (type === "GIFT") {
              await sendGift(formData);
              router.push("/my/gifts");
            } else {
              const { id } = await createListing(formData);
              router.push(`/market/${id}`);
            }
          } catch (err) {
            submittingRef.current = false;
            setError(getErrorMessage(err));
          }
        });
      }}
      className="flex flex-col"
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:gap-0">
        {/* Columna izquierda: escanear captura (si está disponible). */}
        {recognitionEnabled && (
          <>
            <div className="sm:w-56 sm:shrink-0">
              <ScreenshotDropzone onScan={handleScreenshotScan} isScanning={isRecognizing} />
              {recognitionNote && <p className="mt-2 text-xs text-ro-text-muted">{recognitionNote}</p>}
            </div>

            {/* Separador "O": vertical en desktop, horizontal en móvil. */}
            <div className="flex items-center gap-2 sm:mx-4 sm:flex-col">
              <span className="h-px flex-1 bg-ro-panel-border sm:h-auto sm:w-px" />
              <span className="text-xs font-bold text-ro-text-muted">{t("or")}</span>
              <span className="h-px flex-1 bg-ro-panel-border sm:h-auto sm:w-px" />
            </div>
          </>
        )}

        {/* Columna derecha: formulario. */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Ítem. */}
          <ItemPicker selected={selectedItem} onSelect={handleItemSelect} onClear={handleItemClear} />
          <input type="hidden" name="itemId" value={selectedItem?.id ?? ""} />

          {/* Tipo (fuera de las pestañas). */}
          <div role="group" aria-label={t("typeLabel")} className="flex gap-1.5 rounded-full border border-ro-panel-border bg-ro-panel-alt p-1">
            {TYPE_SEGMENTS.map((seg) => {
              const active = seg.value === type;
              const label = t(`typeOptions.${seg.value}`);
              return (
                <button
                  key={seg.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleTypeChange(seg.value)}
                  className={`flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-1.5 py-1.5 text-xs font-medium transition-colors ${
                    active ? `${seg.activeBg} text-ro-on-type` : "text-ro-text hover:bg-ro-panel-border/40"
                  }`}
                >
                  <seg.Icon size={14} className={`shrink-0 ${active ? "" : seg.iconColor}`} aria-hidden />
                  <span className="hidden truncate sm:inline">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Info (siempre visible; sin pestañas). */}
          <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                {showPrice && (
                  <FloatingField
                    label={type === "BUY" ? t("payUpToLabel") : t("priceLabel")}
                    className={`col-span-2 ${priceMissing ? "border-red-600" : ""}`}
                  >
                    {noPrice ? (
                      <span className="text-sm text-ro-text-muted">
                        {type === "BUY" ? tField("bestPrice") : tField("bestOffer")}
                      </span>
                    ) : (
                      <MaskedPriceInput value={price} onChange={setPrice} placeholder="0" className={floatingControlClass} />
                    )}
                    <input type="hidden" name="price" value={price === "" ? "" : String(price)} />
                  </FloatingField>
                )}

                <FloatingField label={tField("quantity")} className={quantityLocked ? "col-span-2" : ""}>
                  {quantityLocked ? (
                    <>
                      <span className="text-sm text-ro-text">1</span>
                      <input type="hidden" name="quantity" value={1} />
                    </>
                  ) : (
                    <input
                      type="number"
                      name="quantity"
                      min={1}
                      defaultValue={1}
                      required={!unlimited}
                      disabled={canBeUnlimited && unlimited}
                      className={floatingControlClass}
                    />
                  )}
                </FloatingField>

                {refineEligible && (
                  <FloatingField label={tField("refine")}>
                    <input
                      type="number"
                      name="refineLevel"
                      min={0}
                      max={maxRefineLevel}
                      value={refineLevel}
                      onChange={(e) => setRefineLevel(e.target.value === "" ? 0 : Number(e.target.value))}
                      className={floatingControlClass}
                    />
                  </FloatingField>
                )}

                {maxCardSlots > 0 && (
                  <FloatingField label={tField("cardSlots")}>
                    <input
                      type="number"
                      name="cardSlots"
                      min={0}
                      max={maxCardSlots}
                      value={cardSlots}
                      onChange={(e) => setCardSlots(e.target.value === "" ? 0 : Number(e.target.value))}
                      className={floatingControlClass}
                    />
                  </FloatingField>
                )}
              </div>

              {/* Toggles contextuales. */}
              <div className="flex flex-wrap gap-4">
                {canBeUnlimited && (
                  <label className="flex items-center gap-2 text-xs text-ro-text-muted">
                    <input type="checkbox" name="unlimited" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
                    {t("unlimitedLabel")}
                  </label>
                )}
                {showPrice && (
                  <label className="flex items-center gap-2 text-xs text-ro-text-muted">
                    <input type="checkbox" name="noPrice" checked={noPrice} onChange={(e) => setNoPrice(e.target.checked)} />
                    {t("noPriceLabel")}
                  </label>
                )}
              </div>

              {/* Destinatario (regalo). */}
              {type === "GIFT" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ro-text-muted">{t("recipientLabel")}</label>
                  <UserPicker key={selectedRecipient?.id ?? "empty"} onSelect={setSelectedRecipient} />
                  <input type="hidden" name="recipientId" value={selectedRecipient?.id ?? ""} />
                </div>
              )}
            </div>

          {/* Opciones (si el ítem las admite): apiladas bajo Info, sin pestañas. */}
          {hasOptionCatalog && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-ro-text-muted">
                {type === "BUY" ? tField("minStats") : tField("options")}
                {optionsCount > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-ro-accent px-1 text-[10px] font-bold text-ro-accent-contrast">
                    {optionsCount}
                  </span>
                )}
              </div>
              {Array.from({ length: MAX_OPTION_SLOTS }, (_, i) => i + 1).map((slotIndex) => {
                const index = slotIndex - 1;
                const selectEnabled = index === 0 || optionSelections[index - 1].defId !== "";
                const selection = optionSelections[index];
                const defsForSlot = optionDefs.filter((d) => d.slotIndex === slotIndex);
                const selectedDef = defsForSlot.find((d) => d.id === selection.defId);
                const isOutOfRange =
                  selectedDef !== undefined &&
                  selection.value !== "" &&
                  (selection.value < selectedDef.minValue || selection.value > selectedDef.maxValue);

                return (
                  <div key={slotIndex} className="flex items-center gap-2">
                    <select
                      name={`option${slotIndex}DefId`}
                      value={selection.defId}
                      disabled={!selectEnabled}
                      onChange={(e) => handleSelectChange(index, e.target.value)}
                      className={`min-w-0 flex-1 ${selectClass}`}
                    >
                      <option value="">{tFilters("optionPlaceholder", { slot: slotIndex })}</option>
                      {defsForSlot.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      name={`option${slotIndex}Value`}
                      min={selectedDef?.minValue}
                      max={selectedDef?.maxValue}
                      placeholder={selectedDef ? `${selectedDef.minValue} - ${selectedDef.maxValue}` : undefined}
                      value={selection.value}
                      disabled={!selection.defId}
                      required={!!selection.defId}
                      onChange={(e) => handleValueChange(index, e.target.value === "" ? "" : Number(e.target.value))}
                      className={`w-28 rounded-lg border border-ro-panel-border bg-ro-panel-alt px-2.5 py-1.5 text-sm text-ro-text focus:border-ro-accent focus:outline-none disabled:opacity-50`}
                      style={isOutOfRange ? { borderColor: "#dc2626" } : undefined}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </div>

      {/* Pie: Cancelar + Publicar (juntos a la derecha; Publicar rojo). */}
      <div className="flex shrink-0 justify-end gap-2 border-t border-ro-panel-border bg-ro-panel-header px-4 py-3">
        <button type="button" onClick={onClose} className={buttonClass("secondary")}>
          {tCommon("cancel")}
        </button>
        <button type="submit" disabled={!canSubmit || isSubmitting} className={buttonClass("primary")}>
          {isSubmitting ? t("publishing") : t(`submitLabels.${type}`)}
        </button>
      </div>
    </form>
  );
}

