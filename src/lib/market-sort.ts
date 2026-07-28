// Orden del listado de mercado. Vive en su propio módulo (sin Prisma) para que
// lo puedan importar componentes CLIENTE (p.ej. SortSelect) sin arrastrar
// src/lib/market.ts —y con él el cliente de Prisma y el driver pg— al bundle
// del navegador. src/lib/market.ts re-exporta estos símbolos para el código de
// servidor que ya los importaba desde ahí.

export const SORT_VALUES = [
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
  "name_asc",
  "name_desc",
] as const;

export type MarketSort = (typeof SORT_VALUES)[number];

export function isMarketSort(value: string): value is MarketSort {
  return (SORT_VALUES as readonly string[]).includes(value);
}
