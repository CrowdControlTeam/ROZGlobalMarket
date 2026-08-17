// Orden del listado de mercado. Vive en su propio módulo (sin Prisma) para que
// lo puedan importar componentes CLIENTE (p.ej. SortSelect) sin arrastrar
// src/lib/market.ts —y con él el cliente de Prisma y el driver pg— al bundle
// del navegador. src/lib/market.ts re-exporta estos símbolos para el código de
// servidor que ya los importaba desde ahí.

// Ordenadas por parejas descendente → ascendente (misma dirección en las tres
// categorías: fecha, precio, nombre), para que el selector alterne ↓ ↑ de
// forma consistente. El valor por defecto sigue siendo "newest".
export const SORT_VALUES = [
  "newest",
  "oldest",
  "price_desc",
  "price_asc",
  "name_desc",
  "name_asc",
] as const;

export type MarketSort = (typeof SORT_VALUES)[number];

// Dirección de cada orden, para pintar la flecha (↓ descendente / ↑ ascendente)
// en el selector.
export const SORT_DIRECTION: Record<MarketSort, "asc" | "desc"> = {
  newest: "desc",
  oldest: "asc",
  price_desc: "desc",
  price_asc: "asc",
  name_desc: "desc",
  name_asc: "asc",
};

export function isMarketSort(value: string): value is MarketSort {
  return (SORT_VALUES as readonly string[]).includes(value);
}
