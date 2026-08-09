"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ItemOptionDef } from "@prisma/client";
import { createListing, getOptionChoices, getMaxRefineLevel } from "@/lib/listings";
import { sendGift } from "@/lib/gifts";
import { recognizeItemFromScreenshot } from "@/lib/item-recognition";
import { buttonClass, inputClass, inputBaseClass, selectClass, labelClass } from "@/lib/ui";
import { PriceInput } from "@/components/PriceInput";
import {
  MAX_OPTION_SLOTS,
  emptyOptionSelections,
  buildOptionSelectionsFromDetected,
  type OptionSelection,
} from "@/lib/item-options-constants";
import { isRefineEligible, DEFAULT_MAX_REFINE_LEVEL } from "@/lib/refine-constants";
import { getMaxCardSlots } from "@/lib/card-slots-constants";
import { getErrorMessage, rethrowFrameworkErrors } from "@/lib/errors";
import { ItemPicker, type ItemResult } from "./ItemPicker";
import { ScreenshotDropzone } from "./ScreenshotDropzone";
import { UserPicker, type UserResult } from "@/components/UserPicker";

export type PublicationType = "SALE" | "BUY" | "TRADE" | "GIFT";

const TYPE_VALUES: PublicationType[] = ["SALE", "BUY", "TRADE", "GIFT"];

export function NewPublicationForm({
  recognitionEnabled,
  initialType,
}: {
  recognitionEnabled: boolean;
  initialType: PublicationType;
}) {
  const router = useRouter();
  const [type, setType] = useState<PublicationType>(initialType);
  const [selectedItem, setSelectedItem] = useState<ItemResult | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<UserResult | null>(null);
  const [optionDefs, setOptionDefs] = useState<ItemOptionDef[]>([]);
  const [optionSelections, setOptionSelections] = useState<OptionSelection[]>(
    emptyOptionSelections(),
  );
  const [refineLevel, setRefineLevel] = useState(0);
  const [cardSlots, setCardSlots] = useState(0);
  // "Sin tope" ("los que tengas"): solo SALE/BUY de materiales. Envía
  // unlimited=on y oculta el campo de cantidad (el server pone quantity null).
  const [unlimited, setUnlimited] = useState(false);
  // "Sin precio" (competitivo): solo SALE/BUY. Envía noPrice=on, oculta el precio
  // (el server pone price null) y la contraparte puja/oferta su precio.
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

  useEffect(() => {
    getMaxRefineLevel().then(setMaxRefineLevel);
  }, []);

  const optionGroup = selectedItem?.optionGroup ?? null;
  const refineEligible = selectedItem !== null && isRefineEligible(selectedItem);
  const maxCardSlots = selectedItem !== null ? getMaxCardSlots(selectedItem) : 0;
  // Un trade tampoco admite cantidad > 1 (ver nota en listings.ts). Un
  // regalo tiene el mismo criterio que una venta: si el item es
  // option-eligible representa una instancia real única, no varias copias
  // Ya no se fuerza cantidad 1 en ningún tipo: el usuario la pone libremente
  // (TRADE incluido — el intercambio es por el lote completo, ver trade-offers).
  // Ilimitado sigue igual: BUY, o SALE sin options (no ilimitado para items con
  // options aleatorias). Ver listings.ts/gifts.ts (servidor).
  const canBeUnlimited = type === "BUY" || (type === "SALE" && optionGroup === null);

  // El reset de optionSelections se dispara desde el evento de selección de
  // item (handleItemSelect más abajo), no aquí: sincronizar dos piezas de
  // estado dentro de un efecto dispara un render en cascada innecesario.
  useEffect(() => {
    if (!optionGroup) return;
    getOptionChoices(optionGroup).then(setOptionDefs);
  }, [optionGroup]);

  const hasOptionCatalog = optionGroup !== null && optionDefs.length > 0;

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
        // recognizeItemFromScreenshot ya captura sus propios fallos (Gemini,
        // catálogo...) y los devuelve como status "error" — este catch es
        // solo para el caso de que el propio server action se caiga antes
        // de devolver un RecognitionResult, que si no quedaba sin ningún
        // feedback visible para el usuario.
        rethrowFrameworkErrors(err);
        console.error(err);
        setRecognitionNote(t("recognitionCallFailed"));
      }
    });
  }

  // Elegir un option real en `index` habilita su input. Volver al placeholder
  // limpia esa fila. En SALE/TRADE/GIFT (instancia real, sin huecos) limpiar una
  // fila limpia también todas las siguientes; en BUY (huecos permitidos) solo
  // limpia la suya.
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
      // Sin valor por defecto: el input arranca vacío (el rango se ve en el
      // placeholder) para que el usuario solo tenga que escribir, no borrar.
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

  // El destinatario de un regalo es OPCIONAL: sin él, el regalo es reclamable
  // por cualquiera (ver sendGift en gifts.ts).
  const canSubmit = selectedItem !== null;
  // useTransition por sí solo no basta: disabled={isPending} solo se
  // refleja en el DOM tras el siguiente render, y varios clics muy
  // seguidos (mash-click) pueden dispararse antes de ese commit — se
  // comprobó de verdad publicando 5 veces el mismo item con clics
  // sintéticos sin espera entre ellos. Este ref se lee/escribe de forma
  // síncrona en el propio evento, sin depender de ningún render.
  const submittingRef = useRef(false);

  return (
    <form
      // Aviso visual instantáneo del precio (borde rojo) en onSubmit, NO dentro
      // de `action`: si falta el precio hacemos preventDefault y así el `action`
      // no llega a ejecutarse, evitando el reset automático del formulario que
      // React 19 dispara al terminar una función `action` — ese reset vaciaba
      // las options ya rellenadas. La validación real sigue en el servidor
      // (createListing en listings.ts); esto es solo UX.
      onSubmit={(e) => {
        const priceRequired = (type === "SALE" || type === "BUY") && !noPrice;
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
              // Ya hay una preview antes de confirmar, así que tras publicar
              // volvemos al mercado (donde aparece el listing recién creado,
              // revalidado en createListing) en vez de abrir su detalle.
              await createListing(formData);
              router.push("/market");
            }
          } catch (err) {
            submittingRef.current = false;
            setError(getErrorMessage(err));
          }
        });
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <label className={labelClass}>{t("typeLabel")}</label>
        <select
          name="type"
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as PublicationType)}
          className={selectClass}
        >
          {TYPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {t(`typeOptions.${value}`)}
            </option>
          ))}
        </select>
      </div>

      {recognitionEnabled && (
        <div>
          <label className={labelClass}>{t("recognitionLabel")}</label>
          <ScreenshotDropzone onScan={handleScreenshotScan} isScanning={isRecognizing} />
          {recognitionNote && <p className="mt-1 text-sm text-ro-text-muted">{recognitionNote}</p>}
        </div>
      )}

      <div>
        <label className={labelClass}>{t("itemLabel")}</label>
        <ItemPicker selected={selectedItem} onSelect={handleItemSelect} onClear={handleItemClear} />
        <input type="hidden" name="itemId" value={selectedItem?.id ?? ""} />
      </div>

      <div>
        <label className={labelClass}>{tField("quantity")}</label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            name="quantity"
            min={1}
            defaultValue={1}
            required={!unlimited}
            disabled={canBeUnlimited && unlimited}
            className={`${inputClass} min-w-0 flex-1`}
          />
          {canBeUnlimited && (
            <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm text-ro-text-muted">
              <input
                type="checkbox"
                name="unlimited"
                checked={unlimited}
                onChange={(e) => setUnlimited(e.target.checked)}
              />
              {t("unlimitedLabel")}
            </label>
          )}
        </div>
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

      {(type === "SALE" || type === "BUY") && (
        <div>
          <label className={labelClass}>{type === "BUY" ? t("payUpToLabel") : t("priceLabel")}</label>
          <div className="flex items-center gap-3">
            {noPrice ? (
              <p className="min-w-0 flex-1 text-sm text-ro-text-muted">
                {type === "BUY" ? tField("bestPrice") : tField("bestOffer")}
              </p>
            ) : (
              <div className="min-w-0 flex-1">
                <PriceInput name="price" placeholder="0" invalid={priceMissing} />
              </div>
            )}
            <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm text-ro-text-muted">
              <input
                type="checkbox"
                name="noPrice"
                checked={noPrice}
                onChange={(e) => setNoPrice(e.target.checked)}
              />
              {t("noPriceLabel")}
            </label>
          </div>
        </div>
      )}

      {type === "GIFT" && (
        <div>
          <label className={labelClass}>{t("recipientLabel")}</label>
          <UserPicker key={selectedRecipient?.id ?? "empty"} onSelect={setSelectedRecipient} />
          <input type="hidden" name="recipientId" value={selectedRecipient?.id ?? ""} />
        </div>
      )}

      {hasOptionCatalog && (
        <div>
          <label className={labelClass}>{type === "BUY" ? tField("minStats") : tField("options")}</label>
          <div className="flex flex-col gap-2">
            {Array.from({ length: MAX_OPTION_SLOTS }, (_, i) => i + 1).map((slotIndex) => {
              const index = slotIndex - 1;
              // En BUY (mínimo deseado) cada slot es independiente: se puede
              // pedir "slot 2 = flee" sin llenar el 1. En el resto, secuencial
              // (instancia real, sin huecos).
              const selectEnabled = type === "BUY" || index === 0 || optionSelections[index - 1].defId !== "";
              const selection = optionSelections[index];
              const defsForSlot = optionDefs.filter((d) => d.slotIndex === slotIndex);
              const selectedDef = defsForSlot.find((d) => d.id === selection.defId);
              // Solo se marca en rojo si hay un valor escrito y se sale del
              // rango — nunca por estar vacío (required ya lo cubre al
              // enviar, sin necesidad de pintarlo antes de que el usuario
              // escriba nada).
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
                    onChange={(e) =>
                      handleValueChange(index, e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className={`w-28 ${inputBaseClass}`}
                    // Un className condicional no basta: focus:border-ro-gold-dark
                    // de inputBaseClass le gana a un focus:border-red-600 según
                    // el orden interno con el que Tailwind genera el CSS, no el
                    // orden de escritura. El estilo inline sí tiene prioridad
                    // garantizada sobre cualquier clase, enfocado o no.
                    style={isOutOfRange ? { borderColor: "#dc2626" } : undefined}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        className={buttonClass("primary")}
      >
        {isSubmitting ? t("publishing") : t(`submitLabels.${type}`)}
      </button>
    </form>
  );
}
