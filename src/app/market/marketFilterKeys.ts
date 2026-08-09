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

// Nº de filtros ACTIVOS de una búsqueda (para el contador de la pestaña). Los
// pares mín/máx (precio, refino, slots) cuentan como 1, cada slot de opción con
// stat cuenta 1, y `poster` cuenta 1. Los filtros MULTI-VALOR (categoría, slot,
// tipo de arma) cuentan CADA valor elegido (CSV), para cuadrar con el contador
// del panel (p. ej. 3 categorías = 3). El orden (`sort`) NO cuenta: es
// ordenación, no un filtro.
export function countFilters(f: Filters): number {
  let n = 0;
  if (f.type) n++;
  if (f.q) n++;
  n += csvCount(f.category);
  n += csvCount(f.slot);
  n += csvCount(f.weaponType);
  if (f.posterId) n++;
  if (f.minPrice || f.maxPrice) n++;
  if (f.refineMin || f.refineMax) n++;
  if (f.cardSlotsMin || f.cardSlotsMax) n++;
  for (let i = 1; i <= MAX_OPTION_SLOTS; i++) if (f[`option${i}Stat`]) n++;
  return n;
}

// Nº de valores en una clave CSV (multi-valor). "" / undefined => 0.
function csvCount(value: string | undefined): number {
  return value ? value.split(",").filter(Boolean).length : 0;
}
