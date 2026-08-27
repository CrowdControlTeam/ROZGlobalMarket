import { and, asc, count, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@/db";
import { item, type ItemCategory } from "@/db/schema";
import { requireSession } from "@/lib/guard";

// Página DB → Items. Consulta la tabla Item con búsqueda por nombre + filtro de
// categoría, paginada.
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
  const conditions = [];
  if (q && q.trim()) conditions.push(ilike(item.name, `%${q.trim()}%`));
  if (categories && categories.length > 0) conditions.push(inArray(item.category, categories));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, totalResult] = await Promise.all([
    db
      .select({
        id: item.id,
        name: item.name,
        iconUrl: item.iconUrl,
        category: item.category,
        slotCount: item.slotCount,
      })
      .from(item)
      .where(where)
      .orderBy(asc(item.name))
      .limit(DB_ITEMS_PAGE_SIZE)
      .offset((page - 1) * DB_ITEMS_PAGE_SIZE),
    db.select({ value: count() }).from(item).where(where),
  ]);
  const total = totalResult[0]?.value ?? 0;

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
  const rows = await db.select().from(item).where(eq(item.id, id)).limit(1);
  return rows[0] ?? null;
}

export type DbItemDetail = NonNullable<Awaited<ReturnType<typeof getDbItemDetail>>>;
