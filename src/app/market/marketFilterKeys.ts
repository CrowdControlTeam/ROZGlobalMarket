import { MAX_OPTION_SLOTS } from "@/lib/item-options-constants";

// Claves de queryParam que son "filtros" (definen una búsqueda). Todo lo demás
// en la URL (p. ej. `listing` del detalle) queda fuera del store de búsqueda.
//
// Este módulo es plano (SIN "use client") a propósito: lo consumen tanto el
// store de cliente (marketSearchStore) como el server component
// (MarketPageContent), que necesita el array real —no una referencia de
// cliente— para sembrar los filtros iniciales.
export const FILTER_KEYS: string[] = [
  "type",
  "q",
  "sort",
  "category",
  "slot",
  "weaponType",
  "posterId",
  "posterName",
  "minPrice",
  "maxPrice",
  "refineMin",
  "refineMax",
  "cardSlotsMin",
  "cardSlotsMax",
  ...Array.from({ length: MAX_OPTION_SLOTS }, (_, i) => i + 1).flatMap((n) => [
    `option${n}Stat`,
    `option${n}Min`,
    `option${n}Max`,
  ]),
];

export type Filters = Record<string, string>;
