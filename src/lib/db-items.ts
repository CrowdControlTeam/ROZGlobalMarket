import type { ItemCategory } from "@/db/enums";
import { requireSession } from "@/lib/guard";
import { getAllItems, getItem } from "@/lib/item-store";

// Página DB → Items. Búsqueda por nombre + filtro de categoría, paginada, sobre
// el catálogo completo en memoria (item-store) — los items no viven en la BD.
export const DB_ITEMS_PAGE_SIZE = 48;

export type DbItemCard = {
  id: string;
  name: string;
  iconUrl: string;
  category: ItemCategory;
  slotCount: number;
};

export async function searchDbItems({
  q,
  categories,
  page,
}: {
  q?: string;
  categories?: ItemCategory[];
  page: number;
}) {
  await requireSession();
  const query = q?.trim().toLowerCase();
  const cats = categories && categories.length > 0 ? new Set(categories) : null;
  const matches = getAllItems().filter(
    (i) => (!query || i.name.toLowerCase().includes(query)) && (!cats || cats.has(i.category)),
  );
  matches.sort((a, b) => a.name.localeCompare(b.name));

  const total = matches.length;
  const start = (page - 1) * DB_ITEMS_PAGE_SIZE;
  const items: DbItemCard[] = matches
    .slice(start, start + DB_ITEMS_PAGE_SIZE)
    .map((i) => ({ id: i.id, name: i.name, iconUrl: i.iconUrl, category: i.category, slotCount: i.slotCount }));

  return {
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / DB_ITEMS_PAGE_SIZE)),
  };
}

// Detalle completo para el tooltip estilo juego (imagen /details + descripción
// con colores + stats). Se pide al hacer click, no se manda todo en el grid.
export async function getDbItemDetail(id: string) {
  await requireSession();
  return getItem(id) ?? null;
}

export type DbItemDetail = NonNullable<Awaited<ReturnType<typeof getDbItemDetail>>>;
