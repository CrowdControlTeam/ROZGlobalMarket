"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tag, ShoppingCart, ArrowLeftRight, Gift, Coins, Infinity as InfinityIcon } from "lucide-react";
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

// Formulario de publicar del rediseño (2 columnas: escaneo · O · formulario;
// una sola columna si el reconocimiento no está disponible). Reutiliza íntegra
// la lógica del NewPublicationForm de página; el contrato de FormData hacia
// createListing/sendGift es idéntico.
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
  const [tab, setTab] = useState<"info" | "options">("info");
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
    setTab("info");
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

  // ── Columna de formulario (derecha, o única si no hay escáner). ──
  const formColumn = (
    <div className="flex min-w-0 flex-col gap-3 sm:h-full">
      {/* Ítem. */}
      <ItemPicker selected={selectedItem} onSelect={handleItemSelect} onClear={handleItemClear} />
      <input type="hidden" name="itemId" value={selectedItem?.id ?? ""} />

      {/* Tipo (fuera de las pestañas). */}
      <div role="group" aria-label={t("typeLabel")} className="flex gap-1 rounded-full border border-ro-panel-border bg-ro-panel-alt p-1">
        {TYPE_SEGMENTS.map((seg) => {
          const active = seg.value === type;
          const label = t(`typeOptions.${seg.value}`);
          return (
            <button
              key={seg.value}
              type="button"
              aria-pressed={active}
              aria-label={label}
              title={label}
              onClick={() => handleTypeChange(seg.value)}
              className={`flex flex-1 items-center justify-center rounded-full py-1.5 transition-colors ${
                active ? `${seg.activeBg} text-ro-on-type` : "text-ro-text hover:bg-ro-panel-border/40"
              }`}
            >
              <seg.Icon size={15} className={active ? "" : seg.iconColor} aria-hidden />
            </button>
          );
        })}
      </div>

      {/* Pestañas SOLO si el ítem admite opciones (con un único "Info" no aporta
          nada). Sin opciones, los campos de Info van directos, sin barra. */}
      {hasOptionCatalog && (
        <div className="flex gap-1 border-b border-ro-panel-border">
          <TabButton active={tab === "info"} onClick={() => setTab("info")}>
            {t("tabs.info")}
          </TabButton>
          <TabButton active={tab === "options"} onClick={() => setTab("options")}>
            {type === "BUY" ? tField("minStats") : tField("options")}
            {optionsCount > 0 && (
              <span className="grid h-3.5 min-w-3.5 place-items-center rounded-full bg-ro-accent px-1 text-[8px] font-bold text-ro-accent-contrast">
                {optionsCount}
              </span>
            )}
          </TabButton>
        </div>
      )}

      {tab === "info" || !hasOptionCatalog ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            {showPrice && (
              <FloatingField
                label={type === "BUY" ? t("payUpToLabel") : t("priceLabel")}
                className={priceMissing ? "border-red-600" : undefined}
              >
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    {noPrice ? (
                      <span className="text-sm text-ro-text-muted">
                        {type === "BUY" ? tField("bestPrice") : tField("bestOffer")}
                      </span>
                    ) : (
                      <MaskedPriceInput value={price} onChange={setPrice} placeholder="0" className={floatingControlClass} />
                    )}
                  </div>
                  <AffixToggle active={noPrice} onToggle={() => setNoPrice(!noPrice)} label={t("noPriceLabel")}>
                    <Coins size={15} />
                  </AffixToggle>
                </div>
                {noPrice ? (
                  <input type="hidden" name="noPrice" value="on" />
                ) : (
                  <input type="hidden" name="price" value={price === "" ? "" : String(price)} />
                )}
              </FloatingField>
            )}

            <FloatingField label={tField("quantity")}>
              {quantityLocked ? (
                <>
                  <span className="text-sm text-ro-text">1</span>
                  <input type="hidden" name="quantity" value={1} />
                </>
              ) : (
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    {unlimited ? (
                      <span className="text-sm text-ro-text-muted">{t("unlimitedLabel")}</span>
                    ) : (
                      <input type="number" name="quantity" min={1} defaultValue={1} required className={floatingControlClass} />
                    )}
                  </div>
                  {canBeUnlimited && (
                    <AffixToggle active={unlimited} onToggle={() => setUnlimited(!unlimited)} label={t("unlimitedLabel")}>
                      <InfinityIcon size={15} />
                    </AffixToggle>
                  )}
                  {unlimited && <input type="hidden" name="unlimited" value="on" />}
                </div>
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

          {/* Destinatario (regalo). */}
          {type === "GIFT" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-ro-text-muted">{t("recipientLabel")}</label>
              <UserPicker key={selectedRecipient?.id ?? "empty"} onSelect={setSelectedRecipient} />
              <input type="hidden" name="recipientId" value={selectedRecipient?.id ?? ""} />
            </div>
          )}

          {/* Notas: rellena el hueco del alto fijo. Sin `name` — de momento no
              se envía ni se guarda (solo diseño). */}
          <FloatingField label={t("notes")} className="min-h-[3.5rem] flex-1">
            <textarea className={`${floatingControlClass} h-full resize-none`} />
          </FloatingField>
        </div>
      ) : (
        /* Pestaña Opciones: 3 filas fijas (desplegable + valor). */
        <div className="flex flex-col gap-2">
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
              // Apilado: el select ocupa el ancho completo (así el nombre del
              // stat se ve entero); el valor aparece debajo solo al elegir stat.
              <div key={slotIndex} className="flex flex-col gap-1">
                <select
                  name={`option${slotIndex}DefId`}
                  value={selection.defId}
                  disabled={!selectEnabled}
                  onChange={(e) => handleSelectChange(index, e.target.value)}
                  className={`w-full ${selectClass}`}
                >
                  <option value="">{tFilters("optionPlaceholder", { slot: slotIndex })}</option>
                  {defsForSlot.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
                {selection.defId && (
                  <input
                    type="number"
                    name={`option${slotIndex}Value`}
                    min={selectedDef?.minValue}
                    max={selectedDef?.maxValue}
                    placeholder={selectedDef ? `${selectedDef.minValue}-${selectedDef.maxValue}` : undefined}
                    value={selection.value}
                    required
                    onChange={(e) => handleValueChange(index, e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-32 rounded-lg border border-ro-panel-border bg-ro-panel-alt px-2.5 py-1.5 text-sm text-ro-text focus:border-ro-accent focus:outline-none"
                    style={isOutOfRange ? { borderColor: "#dc2626" } : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        const priceRequired = showPrice && !noPrice;
        const priceEmpty = priceRequired && !new FormData(e.currentTarget).get("price");
        setPriceMissing(priceEmpty);
        if (priceEmpty) {
          setTab("info");
          e.preventDefault();
        }
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
      {recognitionEnabled ? (
        // 2 columnas iguales (escáner · O · formulario), apiladas en móvil. Alto
        // fijo en desktop para que el modal no cambie de tamaño al aparecer/
        // desaparecer campos; el formulario hace scroll interno si algún caso se
        // pasa, y el cuadro de escaneo rellena ese alto.
        <div className="grid grid-cols-1 gap-3 p-3 sm:h-[22rem] sm:grid-cols-[1fr_auto_1fr] sm:gap-0">
          <div className="flex min-w-0 flex-col sm:p-2">
            <ScreenshotDropzone onScan={handleScreenshotScan} isScanning={isRecognizing} />
            {recognitionNote && <p className="mt-2 text-xs text-ro-text-muted">{recognitionNote}</p>}
          </div>
          {/* Separador "O": vertical en desktop, horizontal en móvil. */}
          <div className="flex items-center gap-2 sm:flex-col sm:px-1">
            <span className="h-px flex-1 bg-ro-panel-border sm:h-auto sm:w-px" />
            <span className="shrink-0 text-[11px] font-bold text-ro-text-muted">{t("or")}</span>
            <span className="h-px flex-1 bg-ro-panel-border sm:h-auto sm:w-px" />
          </div>
          <div className="min-w-0 sm:overflow-y-auto sm:p-2">{formColumn}</div>
        </div>
      ) : (
        <div className="p-4">{formColumn}</div>
      )}

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

// Toggle "affix" en el borde derecho de un campo: absorbe el antiguo checkbox
// (ilimitados / sin precio) dentro del propio campo. preventDefault evita que el
// clic active la etiqueta contenedora (FloatingField es un <label>).
function AffixToggle({
  active,
  onToggle,
  label,
  children,
}: {
  active: boolean;
  onToggle: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        onToggle();
      }}
      // Aspecto de botón (borde + fondo propio) para que se lea como un control
      // aparte del input, no como un icono decorativo del campo.
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors ${
        active
          ? "border-ro-accent bg-ro-accent text-ro-accent-contrast"
          : "border-ro-panel-border bg-ro-panel-alt text-ro-text-muted hover:border-ro-accent hover:text-ro-text"
      }`}
    >
      {children}
    </button>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-[11px] transition-colors ${
        active ? "border-ro-accent font-bold text-ro-text" : "border-transparent text-ro-text-muted hover:text-ro-text"
      }`}
    >
      {children}
    </button>
  );
}
