import { ItemOptionDef, ItemOptionGroup, WeaponType } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { loadMarketConfig } from "@/lib/market-config";
import { MAX_OPTION_SLOTS, getItemOptionGroup } from "@/lib/item-options-constants";

export { MAX_OPTION_SLOTS, getItemOptionGroup };

// Carga una sola vez por request y reutilizar entre varias llamadas a
// getItemOptionGroup — evita una query por item al resolver listados.
export async function loadMagicalWeaponTypes(): Promise<Set<WeaponType>> {
  const rows = await prisma.magicalWeaponType.findMany({ select: { type: true } });
  return new Set(rows.map((r) => r.type));
}

export async function getOptionsCatalogCount(): Promise<number> {
  return prisma.itemOptionDef.count();
}

// Hace falta el toggle activo (configurable en /admin) Y que el catálogo
// tenga filas — pensado para cuando el mercado sirva varias versiones de RO
// y alguna todavía no tenga su catálogo de options importado: activar el
// toggle sin catálogo no debe simular que la función funciona.
export async function isOptionsFeatureAvailable(): Promise<boolean> {
  const [{ optionsEnabled }, catalogCount] = await Promise.all([
    loadMarketConfig(),
    getOptionsCatalogCount(),
  ]);
  return optionsEnabled && catalogCount > 0;
}

export type RawOption = { slotIndex: number; defId: string; value: number };

// Las options van en campos planos option1DefId/option1Value, etc. (mismo
// estilo que el resto del form, sin arrays anidados en FormData). Parar en
// el primer slot vacío garantiza que siempre ocupen las posiciones desde 1
// en adelante sin huecos, sin necesidad de validarlo aparte. Compartido
// entre listings.ts (SALE/TRADE/BUY) y gifts.ts (GIFT) — mismo formato de
// campos en los dos formularios.
export async function parseOptionsFromFormData(formData: FormData): Promise<RawOption[]> {
  const t = await getTranslations("errors");
  const options: RawOption[] = [];
  for (let slotIndex = 1; slotIndex <= MAX_OPTION_SLOTS; slotIndex++) {
    const defId = formData.get(`option${slotIndex}DefId`);
    if (!defId) break;
    const rawValue = formData.get(`option${slotIndex}Value`);
    if (typeof defId !== "string" || typeof rawValue !== "string") {
      throw new Error(t("invalidOptionData"));
    }
    const value = Number(rawValue);
    if (!Number.isInteger(value)) {
      throw new Error(t("invalidOptionValue"));
    }
    options.push({ slotIndex, defId, value });
  }
  return options;
}

// Valida que cada option pertenezca al grupo/slot correcto del item y que
// el valor caiga en [minValue, maxValue] — igual en SALE/TRADE/GIFT (roll
// exacto de una instancia real) que en BUY (mínimo que pide el comprador,
// ver comentario de ListingOption en schema.prisma): en los dos casos el
// número tiene que ser alcanzable de verdad para esa stat. Devuelve el
// catálogo de defs usadas, indexado por id, para que el caller no repita
// la query (createListing lo reutiliza para el webhook).
export async function validateOptions(
  rawOptions: RawOption[],
  optionGroup: ItemOptionGroup | null,
): Promise<Map<string, ItemOptionDef>> {
  const defsById = new Map<string, ItemOptionDef>();
  if (rawOptions.length === 0) return defsById;
  const t = await getTranslations("errors");
  if (!optionGroup) {
    throw new Error(t("noOptionsAllowed"));
  }

  const defs = await prisma.itemOptionDef.findMany({
    where: { id: { in: rawOptions.map((o) => o.defId) } },
  });
  for (const def of defs) defsById.set(def.id, def);

  for (const raw of rawOptions) {
    const def = defsById.get(raw.defId);
    if (!def || def.group !== optionGroup || def.slotIndex !== raw.slotIndex) {
      throw new Error(t("invalidOptionForItem"));
    }
    if (raw.value < def.minValue || raw.value > def.maxValue) {
      throw new Error(t("optionValueRange", { label: def.label, min: def.minValue, max: def.maxValue }));
    }
  }
  return defsById;
}
