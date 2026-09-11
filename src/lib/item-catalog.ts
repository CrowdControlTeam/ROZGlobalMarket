import type { ItemCategory, EquipSlot, WeaponType } from "@/db/enums";
import { getAllItems } from "@/lib/item-store";

// Vista de BÚSQUEDA del catálogo, derivada del catálogo completo en memoria
// (item-store): solo items COMERCIABLES, con el sufijo de ranuras en el nombre
// ("Coat[1]") para distinguir variantes con/sin ranuras en el autocompletado y el
// reconocimiento por imagen. Antes era un bundle aparte (catalog-search.json),
// ahora se computa del mismo catálogo, sin duplicar datos. Es server-side.
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
  // Slot de equipo donde encaja una carta ("Weapon"/"Armor"/…), solo en CARD.
  // Lo usa el filtrado de cartas por slot al publicar (ver cardFitsEquipSlot).
  cardSlot?: string | null;
};

const CATALOG: CatalogItem[] = getAllItems()
  .filter((i) => i.tradeable)
  .map((i) => ({
    id: i.id,
    // El nombre lleva el sufijo de ranuras ("Coat[1]") para distinguir en la
    // búsqueda las variantes con/sin ranuras del mismo item.
    name: (i.slotCount ?? 0) > 0 ? `${i.name}[${i.slotCount}]` : i.name,
    iconUrl: i.iconUrl,
    category: i.category,
    slot: i.slot,
    weaponType: i.weaponType,
    slotCount: i.slotCount,
    position: i.position,
    cardSlot: i.cardSlot,
  }));

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
