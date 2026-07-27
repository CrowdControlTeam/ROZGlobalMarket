"use server";

import { ItemCategory, EquipSlot, WeaponType, ItemOptionGroup } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import {
  MAX_OPTION_SLOTS,
  getItemOptionGroup,
  loadMagicalWeaponTypes,
  isOptionsFeatureAvailable,
} from "@/lib/item-options";
import { isRefineEligible, loadMaxRefineLevel } from "@/lib/refine";
import { getMaxCardSlots } from "@/lib/card-slots-constants";
import { findBestMatch } from "@/lib/fuzzy-match";
import { loadMarketConfig } from "@/lib/market-config";

// Hace falta el toggle activo (configurable en /admin) Y la variable de
// entorno GEMINI_API_KEY seteada — la key nunca se guarda en base de datos.
// El caller (la página del formulario de venta) usa esto para decidir si
// renderiza el bloque de reconocimiento, no solo si lo deshabilita.
export async function isImageRecognitionAvailable(): Promise<boolean> {
  await requireSession();
  const config = await loadMarketConfig();
  return config.imageRecognitionEnabled && !!process.env.GEMINI_API_KEY;
}

// Umbrales deliberadamente permisivos: un OCR/lectura de la IA no va a ser
// perfecto, pero solo hace falta acercarse lo suficiente a UNA entrada real
// del catálogo (nombres de item y labels de option son bastante distintos
// entre sí dentro de un mismo pool). Si no llega al umbral, se deja sin
// rellenar en vez de arriesgar un match incorrecto.
const NAME_MATCH_THRESHOLD = 0.5;
const OPTION_LABEL_MATCH_THRESHOLD = 0.6;

const ITEM_CATEGORY_VALUES = Object.values(ItemCategory);
const WEAPON_TYPE_VALUES = Object.values(WeaponType);

const PROMPT = `You are looking at a screenshot of an item tooltip from the MMORPG Ragnarok Online.
Extract the following as JSON:
- itemName: the base item name as shown, WITHOUT any refine level prefix (e.g. "+7") and WITHOUT any slot count suffix (e.g. "[4]"). Null if you cannot read a name at all.
- itemCategory: the item's general type as shown in the tooltip (e.g. a weapon, an armor piece, a card, a consumable, a costume, a pet-related item, an enchant/stat stone, or something else/misc). Must be exactly one of the given enum values, picking the closest match. Null if you cannot tell at all.
- weaponType: only when itemCategory is WEAPON, the specific weapon class as shown in the tooltip (e.g. "Two-Handed Sword", "Staff", "Dagger", "Bow", ...), mapped to the closest of the given enum values. Null if itemCategory is not WEAPON, or you cannot tell.
- refineLevel: the refine level shown as a "+N" prefix before the item name, as an integer. 0 if there is no such prefix.
- cardSlots: the number of card slots (sockets) the item actually has, as an integer. The ONLY reliable indicator is a row of small diamond-shaped icons near the bottom of the tooltip — the item name itself never shows a "[N]" bracket suffix in this game's tooltips, so do not infer cardSlots from the name text. That icon row always shows the item category's maximum possible slots, padded with extra plain flat-grey diamonds — it can show MORE icons than the item actually has. Read the row strictly left to right: count only the leading icons that have any color/tint (pink, white, purple, etc.) and stop counting the moment you reach the first plain flat-grey icon, even if there are more icons after it — everything from that point on is just padding, never slots. 0 if there is no icon row at all.
- options: the "random option" bonus lines shown on the tooltip — extra rolled stat bonuses, usually listed separately from the item's fixed base stats/description, in the exact top-to-bottom order they appear. For each one, return the stat label text (without its numeric value) and its numeric value as an integer. Empty array if there are none.
Respond with only the JSON object, no extra commentary.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    itemName: { type: "STRING", nullable: true },
    itemCategory: { type: "STRING", enum: ITEM_CATEGORY_VALUES, nullable: true },
    weaponType: { type: "STRING", enum: WEAPON_TYPE_VALUES, nullable: true },
    refineLevel: { type: "INTEGER" },
    cardSlots: { type: "INTEGER" },
    options: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          value: { type: "INTEGER" },
        },
        required: ["label", "value"],
      },
    },
  },
  required: ["itemName", "refineLevel", "cardSlots", "options"],
};

type GeminiExtraction = {
  itemName: string | null;
  itemCategory: ItemCategory | null;
  weaponType: WeaponType | null;
  refineLevel: number;
  cardSlots: number;
  options: { label: string; value: number }[];
};

function isItemCategory(value: unknown): value is ItemCategory {
  return typeof value === "string" && (ITEM_CATEGORY_VALUES as string[]).includes(value);
}

function isWeaponType(value: unknown): value is WeaponType {
  return typeof value === "string" && (WEAPON_TYPE_VALUES as string[]).includes(value);
}

function isRawOption(value: unknown): value is { label: string; value: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).label === "string" &&
    Number.isInteger((value as Record<string, unknown>).value)
  );
}

async function callGemini(base64: string, mimeType: string, model: string): Promise<GeminiExtraction> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("El reconocimiento por captura no está configurado (falta GEMINI_API_KEY)");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: PROMPT }, { inlineData: { mimeType, data: base64 } }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Gemini respondió con error (${res.status})`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Respuesta de Gemini sin contenido");
  }

  const parsed = JSON.parse(text);
  return {
    itemName: typeof parsed.itemName === "string" ? parsed.itemName : null,
    itemCategory: isItemCategory(parsed.itemCategory) ? parsed.itemCategory : null,
    weaponType: isWeaponType(parsed.weaponType) ? parsed.weaponType : null,
    refineLevel: Number.isInteger(parsed.refineLevel) ? parsed.refineLevel : 0,
    cardSlots: Number.isInteger(parsed.cardSlots) ? parsed.cardSlots : 0,
    options: Array.isArray(parsed.options) ? parsed.options.filter(isRawOption) : [],
  };
}

export type RecognitionResult =
  | {
      status: "matched";
      item: {
        id: string;
        name: string;
        iconUrl: string;
        category: ItemCategory;
        slot: EquipSlot | null;
        weaponType: WeaponType | null;
        optionGroup: ItemOptionGroup | null;
      };
      refineLevel: number;
      cardSlots: number;
      options: { slotIndex: number; defId: string; value: number }[];
    }
  | { status: "no_match"; detectedName: string | null }
  | { status: "error"; message: string };

// Nunca se confía en la respuesta de la IA tal cual: el nombre de item y
// cada option se re-validan por similitud contra el catálogo real (ver
// src/lib/fuzzy-match.ts), y solo lo que supera el umbral llega al
// formulario — que además deja todo editable antes de publicar.
export async function recognizeItemFromScreenshot(formData: FormData): Promise<RecognitionResult> {
  await requireSession();
  const t = await getTranslations("errors");

  // No confiar solo en que el cliente no muestre el bloque: si lo
  // desactivan desde /admin mientras alguien tiene el formulario abierto,
  // la llamada también debe rechazarse aquí.
  const config = await loadMarketConfig();
  if (!config.imageRecognitionEnabled || !process.env.GEMINI_API_KEY) {
    return { status: "error", message: t("recognitionNotActive") };
  }

  const file = formData.get("screenshot");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: t("noImageReceived") };
  }

  // Todo lo de aquí en adelante puede fallar por motivos que no controlamos
  // (Gemini caído, un fallo de Prisma, un bug) — se envuelve entero (antes
  // solo cubría la llamada a Gemini) para que CUALQUIER fallo termine en un
  // status "error" con mensaje genérico, nunca en una excepción sin
  // controlar. El mensaje real solo se registra en el log del servidor —
  // mostrar el error técnico tal cual (p.ej. un fallo de parseo JSON) no
  // ayuda al usuario y puede filtrar detalles internos.
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await callGemini(buffer.toString("base64"), file.type || "image/png", config.geminiModel);

    if (!extraction.itemName) {
      return { status: "no_match", detectedName: null };
    }

    const candidates = await prisma.item.findMany({
      select: { id: true, name: true, iconUrl: true, category: true, slot: true, weaponType: true },
    });

    // El catálogo tiene bastantes nombres duplicados (p.ej. dos "Arc Wand":
    // un báculo real y un costume cosmético) — el nombre solo no basta para
    // desambiguar, así que primero se prueba el match solo entre los
    // candidatos cuya categoría/tipo de arma coincide con lo que el tooltip
    // ya indica, y solo si eso no encuentra nada se cae al catálogo completo
    // (evita que un fallo de la IA leyendo la categoría deje un item sin
    // reconocer del todo).
    let narrowedCandidates = candidates;
    if (extraction.itemCategory) {
      const sameCategory = candidates.filter((c) => c.category === extraction.itemCategory);
      if (sameCategory.length > 0) {
        narrowedCandidates = sameCategory;
        if (extraction.itemCategory === "WEAPON" && extraction.weaponType) {
          const sameWeaponType = sameCategory.filter((c) => c.weaponType === extraction.weaponType);
          if (sameWeaponType.length > 0) narrowedCandidates = sameWeaponType;
        }
      }
    }

    const matchedItem =
      findBestMatch(extraction.itemName, narrowedCandidates, (c) => c.name, NAME_MATCH_THRESHOLD) ??
      (narrowedCandidates !== candidates
        ? findBestMatch(extraction.itemName, candidates, (c) => c.name, NAME_MATCH_THRESHOLD)
        : null);
    if (!matchedItem) {
      return { status: "no_match", detectedName: extraction.itemName };
    }

    const [magicalTypes, optionsAvailable] = await Promise.all([
      loadMagicalWeaponTypes(),
      isOptionsFeatureAvailable(),
    ]);
    const optionGroup = optionsAvailable ? getItemOptionGroup(matchedItem, magicalTypes) : null;

    let refineLevel = 0;
    if (isRefineEligible(matchedItem)) {
      const maxRefineLevel = await loadMaxRefineLevel();
      refineLevel = Math.min(Math.max(extraction.refineLevel, 0), maxRefineLevel);
    }

    const maxCardSlots = getMaxCardSlots(matchedItem);
    const cardSlots = maxCardSlots > 0 ? Math.min(Math.max(extraction.cardSlots, 0), maxCardSlots) : 0;

    const options: { slotIndex: number; defId: string; value: number }[] = [];
    if (optionGroup) {
      const defs = await prisma.itemOptionDef.findMany({ where: { group: optionGroup } });
      for (let i = 0; i < extraction.options.length && i < MAX_OPTION_SLOTS; i++) {
        const slotIndex = i + 1;
        const defsForSlot = defs.filter((d) => d.slotIndex === slotIndex);
        const detected = extraction.options[i];
        const matchedDef = findBestMatch(detected.label, defsForSlot, (d) => d.label, OPTION_LABEL_MATCH_THRESHOLD);
        // Las options ocupan las posiciones desde el slot 1 sin huecos (mismo
        // invariante que el formulario manual) — si un slot no matchea bien,
        // se corta aquí en vez de dejar un hueco a mitad.
        if (!matchedDef) break;
        const value = Math.min(Math.max(detected.value, matchedDef.minValue), matchedDef.maxValue);
        options.push({ slotIndex, defId: matchedDef.id, value });
      }
    }

    return {
      status: "matched",
      item: { ...matchedItem, optionGroup },
      refineLevel,
      cardSlots,
      options,
    };
  } catch (err) {
    console.error("recognizeItemFromScreenshot falló:", err);
    return { status: "error", message: t("recognitionFailed") };
  }
}
