"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tag, ShoppingCart, ArrowLeftRight, Gift, Coins, Infinity as InfinityIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ItemOptionDef, ListingType } from "@prisma/client";
import { createListing, updateListing, getOptionChoices, getMaxRefineLevel } from "@/lib/listings";
import { recognizeItemFromScreenshot } from "@/lib/item-recognition";
import { buttonClass, selectClass } from "@/lib/ui";
import { formatPrice, priceColorClass } from "@/lib/price";
import { listingTypeLabel, LISTING_TYPE_BADGE_CLASS, formatOptionAmount } from "@/lib/market-labels";
import { MaskedPriceInput } from "@/components/MaskedPriceInput";
import { FloatingField, floatingControlClass } from "@/components/FloatingField";
import {
  MAX_OPTION_SLOTS,
  emptyOptionSelections,
  buildOptionSelectionsFromDetected,
  type OptionSelection,
} from "@/lib/item-options-constants";
import { isRefineEligible, DEFAULT_MAX_REFINE_LEVEL } from "@/lib/refine-constants";
import { getMaxCardSlots, formatItemDisplayName } from "@/lib/card-slots-constants";
import { MAX_LISTING_NOTES_LENGTH } from "@/lib/listing-notes-constants";
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
// createListing es idéntico. Con `editListing` funciona en modo EDICIÓN: precarga
// los campos, bloquea tipo e item, oculta el escáner y el destinatario, y envía
// a updateListing en vez de createListing.

// Valores iniciales para el modo edición (los arma EditSlot desde el listing).
export type EditListingData = {
  id: string;
  type: PublicationType;
  item: ItemResult;
  quantity: number | null; // null = ilimitado
  price: number | null; // null = sin precio (SALE/BUY) o no aplica (TRADE/GIFT)
  refineLevel: number;
  cardSlots: number;
  notes: string;
  optionSelections: OptionSelection[];
};

export function PublishForm({
  recognitionEnabled,
  initialType,
  onClose,
  editListing,
}: {
  recognitionEnabled: boolean;
  initialType: PublicationType;
  onClose: () => void;
  editListing?: EditListingData;
}) {
  const router = useRouter();
  const isEdit = editListing !== undefined;
  const [type, setType] = useState<PublicationType>(editListing?.type ?? initialType);
  const [selectedItem, setSelectedItem] = useState<ItemResult | null>(editListing?.item ?? null);
  const [selectedRecipient, setSelectedRecipient] = useState<UserResult | null>(null);
  const [optionDefs, setOptionDefs] = useState<ItemOptionDef[]>([]);
  const [optionSelections, setOptionSelections] = useState<OptionSelection[]>(
    editListing?.optionSelections ?? emptyOptionSelections(),
  );
  const [refineLevel, setRefineLevel] = useState(editListing?.refineLevel ?? 0);
  const [cardSlots, setCardSlots] = useState(editListing?.cardSlots ?? 0);
  const [quantity, setQuantity] = useState<number | "">(editListing ? (editListing.quantity ?? "") : 1);
  const [price, setPrice] = useState<number | "">(editListing ? (editListing.price ?? "") : "");
  const [unlimited, setUnlimited] = useState(editListing ? editListing.quantity === null : false);
  // noPrice (competitivo) solo aplica a SALE/BUY; en TRADE/GIFT el precio es null
  // por naturaleza, no por "sin precio".
  const [noPrice, setNoPrice] = useState(
    editListing ? editListing.price === null && (editListing.type === "SALE" || editListing.type === "BUY") : false,
  );
  const [notes, setNotes] = useState(editListing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [priceMissing, setPriceMissing] = useState(false);
  const [maxRefineLevel, setMaxRefineLevel] = useState(DEFAULT_MAX_REFINE_LEVEL);
  const [isRecognizing, startRecognizeTransition] = useTransition();
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [recognitionNote, setRecognitionNote] = useState<string | null>(null);
  const [tab, setTab] = useState<"info" | "options">("info");
  // Paso de confirmación: al pulsar Publicar se muestra la vista previa (la
  // tarjeta tal cual saldrá) y solo Confirmar publica de verdad.
  const [preview, setPreview] = useState(false);
  const t = useTranslations("market.form");
  const tField = useTranslations("market.field");
  const tFilters = useTranslations("market.filters");
  const tMarket = useTranslations("market");
  const tCommon = useTranslations("common");

  useEffect(() => {
    getMaxRefineLevel().then(setMaxRefineLevel);
  }, []);

  const optionGroup = selectedItem?.optionGroup ?? null;
  const refineEligible = selectedItem !== null && isRefineEligible(selectedItem);
  const maxCardSlots = selectedItem !== null ? getMaxCardSlots(selectedItem) : 0;
  // Ya no se fuerza cantidad 1 en ningún tipo: el usuario la pone libremente
  // (TRADE incluido — el intercambio es por el lote completo, ver trade-offers).
  // Ilimitado sigue igual: BUY, o SALE sin options (no ilimitado para items con
  // options). Ver listings.ts/gifts.ts (servidor autoritativo).
  const canBeUnlimited = type === "BUY" || (type === "SALE" && optionGroup === null);
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

  // En SALE/TRADE/GIFT (instancia real, sin huecos) limpiar una fila limpia
  // también las siguientes; en BUY (mínimo deseado, huecos permitidos) solo la
  // suya. Ver NewPublicationForm y parseOptionsFromFormData (servidor).
  function handleSelectChange(index: number, defId: string) {
    setOptionSelections((prev) => {
      const next = [...prev];
      if (!defId) {
        if (type === "BUY") {
          next[index] = { defId: "", value: "" };
        } else {
          for (let i = index; i < next.length; i++) next[i] = { defId: "", value: "" };
        }
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

  // Construye el FormData desde el ESTADO (no desde los inputs del form): con
  // las pestañas, los inputs de la pestaña inactiva no están montados, así que
  // leer del form perdería datos. El contrato de campos es el de createListing.
  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("type", type);
    fd.set("itemId", selectedItem?.id ?? "");
    if (unlimited) fd.set("unlimited", "on");
    else fd.set("quantity", String(quantity || 1));
    if (refineEligible) fd.set("refineLevel", String(refineLevel));
    if (maxCardSlots > 0) fd.set("cardSlots", String(cardSlots));
    if (showPrice) {
      if (noPrice) fd.set("noPrice", "on");
      else if (price !== "") fd.set("price", String(price));
    }
    if (type === "GIFT" && selectedRecipient) fd.set("recipientId", selectedRecipient.id);
    if (notes.trim()) fd.set("notes", notes);
    optionSelections.forEach((sel, i) => {
      if (sel.defId && sel.value !== "") {
        fd.set(`option${i + 1}DefId`, sel.defId);
        fd.set(`option${i + 1}Value`, String(sel.value));
      }
    });
    return fd;
  }

  // Validación en cliente antes de la vista previa (la real está en el server).
  // Si algo falla, va a la pestaña correspondiente y no muestra la preview.
  function handlePublish() {
    if (!selectedItem) return;
    if (showPrice && !noPrice && price === "") {
      setPriceMissing(true);
      setTab("info");
      return;
    }
    setPriceMissing(false);
    if (!unlimited && (quantity === "" || quantity < 1)) {
      setTab("info");
      return;
    }
    const badOption = optionSelections.some((sel) => {
      if (!sel.defId) return false;
      if (sel.value === "") return true;
      const def = optionDefs.find((d) => d.id === sel.defId);
      return def !== undefined && (sel.value < def.minValue || sel.value > def.maxValue);
    });
    if (badOption) {
      setTab("options");
      return;
    }
    setError(null);
    setPreview(true);
  }

  function handleConfirm() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    startSubmitTransition(async () => {
      try {
        const fd = buildFormData();
        if (isEdit) {
          // Edición: tipo e item los toma el server del listing; el resto se
          // actualiza. Se vuelve al mercado (la card refleja el cambio).
          await updateListing(editListing.id, fd);
          router.push("/market");
          return;
        }
        // Acción única para todos los tipos. Solo el regalo DIRECTO (con
        // destinatario) vuelve a /my/gifts; el resto —incluido el reclamable—
        // vuelve al mercado (ya hay preview antes, así que no abrimos el detalle).
        const { directGift } = await createListing(fd);
        router.push(directGift ? "/my/gifts" : "/market");
      } catch (err) {
        submittingRef.current = false;
        setError(getErrorMessage(err));
      }
    });
  }

  // ── Tarjeta de vista previa (la ficha tal cual saldrá en el mercado). ──
  const previewType = type as ListingType;
  const selectedOptions = optionSelections
    .map((sel) => ({ sel, def: optionDefs.find((d) => d.id === sel.defId) }))
    .filter((o) => o.def !== undefined && o.sel.value !== "");
  const previewCard = selectedItem && (
    <div className="rounded-xl border border-ro-panel-border bg-ro-panel p-3">
      <div className="flex gap-2.5">
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-ro-panel-border bg-ro-panel-alt">
          <Image src={selectedItem.iconUrl} alt="" width={32} height={32} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ro-text">
            {formatItemDisplayName(selectedItem.name, refineLevel, cardSlots)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ro-text-muted">
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide ${LISTING_TYPE_BADGE_CLASS[previewType]}`}>
              {listingTypeLabel(tMarket, previewType)}
            </span>
            <span>· {tCommon("you")}</span>
          </p>
        </div>
      </div>
      {selectedOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selectedOptions.map(({ sel, def }) => (
            <span key={sel.defId} className="rounded border border-ro-accent/30 bg-ro-accent/10 px-1.5 py-0.5 text-[0.65rem] text-ro-accent">
              {def!.label} {formatOptionAmount(Number(sel.value), type === "BUY")}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex justify-end text-sm">
        {type === "TRADE" ? (
          <span className="font-extrabold text-ro-type-trade">{listingTypeLabel(tMarket, "TRADE")}</span>
        ) : type === "GIFT" ? (
          <span className="font-extrabold text-ro-type-buy">{tMarket("results.free")}</span>
        ) : noPrice ? (
          <span className="font-bold text-ro-text-muted">{type === "BUY" ? tField("bestPrice") : tField("bestOffer")}</span>
        ) : (
          <span className={`font-extrabold ${priceColorClass(price === "" ? 0 : price)}`}>
            {formatPrice(price === "" ? 0 : price)}
          </span>
        )}
      </div>
    </div>
  );

  // ── Columna de formulario (derecha, o única si no hay escáner). ──
  const formColumn = (
    <div className="flex min-w-0 flex-col gap-3 sm:h-full">
      {/* Ítem. */}
      <ItemPicker selected={selectedItem} onSelect={handleItemSelect} onClear={handleItemClear} locked={isEdit} />
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
              disabled={isEdit}
              onClick={() => handleTypeChange(seg.value)}
              className={`flex flex-1 items-center justify-center rounded-full py-1.5 transition-colors disabled:cursor-not-allowed ${
                active ? `${seg.activeBg} text-ro-on-type` : "text-ro-text hover:bg-ro-panel-border/40"
              } ${isEdit && !active ? "opacity-40" : ""}`}
            >
              <seg.Icon size={15} className={active ? "" : seg.iconColor} aria-hidden />
            </button>
          );
        })}
      </div>

      {/* Pestañas SOLO en desktop y si el ítem admite opciones. En móvil no hay
          pestañas: Info y Opciones se apilan en una columna (ver más abajo). */}
      {hasOptionCatalog && (
        <div className="hidden gap-1 border-b border-ro-panel-border sm:flex">
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

      {/* Info: en móvil siempre visible; en desktop solo si la pestaña activa es
          Info (o el ítem no tiene opciones). */}
      <div className={`flex min-h-0 flex-1 flex-col gap-3 ${hasOptionCatalog && tab === "options" ? "sm:hidden" : ""}`}>
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
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  {unlimited ? (
                    <span className="text-sm text-ro-text-muted">{t("unlimitedLabel")}</span>
                  ) : (
                    <input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                      className={floatingControlClass}
                    />
                  )}
                </div>
                {canBeUnlimited && (
                  <AffixToggle active={unlimited} onToggle={() => setUnlimited(!unlimited)} label={t("unlimitedLabel")}>
                    <InfinityIcon size={15} />
                  </AffixToggle>
                )}
                {unlimited && <input type="hidden" name="unlimited" value="on" />}
              </div>
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

          {/* Destinatario (regalo). No en edición: un regalo reclamable se
              mantiene reclamable; no se convierte en directo desde el editar. */}
          {type === "GIFT" && !isEdit && (
            <div>
              <label className="mb-1 block text-xs font-medium text-ro-text-muted">{t("recipientLabel")}</label>
              <UserPicker key={selectedRecipient?.id ?? "empty"} onSelect={setSelectedRecipient} />
              <input type="hidden" name="recipientId" value={selectedRecipient?.id ?? ""} />
            </div>
          )}

          {/* Notas libres opcionales (se guardan en el listing y se muestran en
              el detalle). buildFormData las lee del estado, no del DOM. */}
          <FloatingField label={t("notes")} className="min-h-[3.5rem] flex-1">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={MAX_LISTING_NOTES_LENGTH}
              placeholder={t("notesPlaceholder")}
              className={`${floatingControlClass} h-full resize-none`}
            />
          </FloatingField>
      </div>

      {/* Opciones: solo si el ítem las admite. En móvil siempre visibles con un
          encabezado (no hay pestañas); en desktop solo si la pestaña activa es
          Opciones. */}
      {hasOptionCatalog && (
        <div className={tab === "info" ? "sm:hidden" : ""}>
          <div className="mb-2 flex items-center gap-2 border-t border-ro-panel-border pt-3 text-[11px] font-medium uppercase tracking-wide text-ro-text-muted sm:hidden">
            {type === "BUY" ? tField("minStats") : tField("options")}
            {optionsCount > 0 && (
              <span className="grid h-3.5 min-w-3.5 place-items-center rounded-full bg-ro-accent px-1 text-[8px] font-bold text-ro-accent-contrast">
                {optionsCount}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
          {Array.from({ length: MAX_OPTION_SLOTS }, (_, i) => i + 1).map((slotIndex) => {
            const index = slotIndex - 1;
            // BUY: cada slot independiente (mínimo deseado, huecos permitidos);
            // resto: secuencial (instancia real).
            const selectEnabled = type === "BUY" || index === 0 || optionSelections[index - 1].defId !== "";
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
                  placeholder={selectedDef ? `${selectedDef.minValue}-${selectedDef.maxValue}` : undefined}
                  value={selection.value}
                  disabled={!selection.defId}
                  required={!!selection.defId}
                  onChange={(e) => handleValueChange(index, e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-24 shrink-0 rounded-lg border border-ro-panel-border bg-ro-panel-alt px-2.5 py-1.5 text-sm text-ro-text focus:border-ro-accent focus:outline-none disabled:opacity-50"
                  style={isOutOfRange ? { borderColor: "#dc2626" } : undefined}
                />
              </div>
            );
          })}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );

  return (
    <form onSubmit={(e) => e.preventDefault()} className="flex min-h-0 flex-1 flex-col">
      {/* Cuerpo scrolleable; el pie queda fijo abajo (clave en móvil a pantalla
          completa, donde el contenido apilado puede pasar del alto). */}
      <div className="min-h-0 flex-1 overflow-y-auto">
      {preview ? (
        // Vista previa: la ficha tal cual saldrá en el mercado.
        <div className="p-4">
          <p className="mb-2 text-xs text-ro-text-muted">{t("previewHint")}</p>
          {previewCard}
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>
      ) : recognitionEnabled ? (
        // 2 columnas iguales (escáner · O · formulario), apiladas en móvil. Alto
        // fijo en desktop para que el modal no cambie de tamaño al aparecer/
        // desaparecer campos; el formulario hace scroll interno si algún caso se
        // pasa, y el cuadro de escaneo rellena ese alto (cuadrado).
        <div className="grid grid-cols-1 gap-3 p-3 sm:h-[28rem] sm:grid-cols-[1fr_auto_1fr] sm:gap-0">
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
      </div>

      {/* Pie FIJO abajo: en el formulario → Cancelar (cierra) + Publicar (a la
          preview); en la preview → Cancelar (vuelve) + Confirmar (publica). */}
      <div className="flex shrink-0 justify-end gap-2 border-t border-ro-panel-border bg-ro-panel-header px-4 py-3">
        {preview ? (
          <>
            <button type="button" onClick={() => setPreview(false)} className={buttonClass("secondary")}>
              {tCommon("cancel")}
            </button>
            <button type="button" onClick={handleConfirm} disabled={isSubmitting} className={buttonClass("primary")}>
              {isSubmitting ? t("publishing") : t("confirm")}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onClose} className={buttonClass("secondary")}>
              {tCommon("cancel")}
            </button>
            <button type="button" onClick={handlePublish} disabled={!canSubmit} className={buttonClass("primary")}>
              {isEdit ? t("saveLabel") : t(`submitLabels.${type}`)}
            </button>
          </>
        )}
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
