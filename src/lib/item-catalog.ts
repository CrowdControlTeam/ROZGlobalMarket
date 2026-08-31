import type { ItemCategory, EquipSlot, WeaponType } from "@/db/schema";
import catalogData from "@/data/catalog-search.json";

// Catálogo de items recortado a los campos de búsqueda, empaquetado con la app
// (lo genera prisma/importItems.mjs desde el mismo catálogo que va a la BD) y
// cargado en memoria. Así el autocompletado (searchItems) y los candidatos del
// reconocimiento (item-recognition.ts) no pegan a la BD en cada tecla — solo
// importa cuando el servidor sirve una versión de RO global con muchos jugadores
// lejos de la región única de Neon. Es server-side: el JSON nunca se expone.
export type CatalogItem = {
  id: string;
  name: string;
  iconUrl: string;
  category: ItemCategory;
  slot: EquipSlot | null;
  weaponType: WeaponType | null;
  // Nº de ranuras de carta del item (fijo por id) — lo usan el match del
  // reconocimiento (nombre + slots) y la vista previa.
  slotCount: number;
  // Ubicación del tocado ("Upper"/"Middle"/"Lower", o combinaciones separadas
  // por comas). Solo relevante para headgears; null en el resto. Lo usa el
  // filtrado por slot del editor de builds.
  position?: string | null;
};

const CATALOG = catalogData as unknown as CatalogItem[];

// El reconocimiento por captura necesita todo el catálogo para el fuzzy-match.
export function getAllCatalogItems(): CatalogItem[] {
  return CATALOG;
}

// Autocompletado: coincidencias por nombre sin distinguir mayúsculas. Las que
// EMPIEZAN por la consulta van primero (mejor UX que un "contiene" plano), y
// dentro de cada grupo por nombre — mismo criterio de fondo que el
// `contains` insensible que hacía la BD, pero en memoria.
export function searchCatalog(
  query: string,
  limit = 20,
  filter?: (item: CatalogItem) => boolean,
): CatalogItem[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const prefix: CatalogItem[] = [];
  const contains: CatalogItem[] = [];
  for (const item of CATALOG) {
    if (filter && !filter(item)) continue;
    const idx = item.name.toLowerCase().indexOf(q);
    if (idx === 0) prefix.push(item);
    else if (idx > 0) contains.push(item);
  }
  const byName = (a: CatalogItem, b: CatalogItem) => a.name.localeCompare(b.name);
  prefix.sort(byName);
  contains.sort(byName);
  return [...prefix, ...contains].slice(0, limit);
}
