import { ItemCategory, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";

// Página DB → Items. Consulta la tabla Item (fuente de verdad ya en Postgres, no
// hace falta bundle) con búsqueda por nombre + filtro de categoría, paginada.
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
  const where: Prisma.ItemWhereInput = {};
  if (q && q.trim()) where.name = { contains: q.trim(), mode: "insensitive" };
  if (categories && categories.length > 0) where.category = { in: categories };

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * DB_ITEMS_PAGE_SIZE,
      take: DB_ITEMS_PAGE_SIZE,
      select: { id: true, name: true, iconUrl: true, category: true, slotCount: true },
    }),
    prisma.item.count({ where }),
  ]);

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
  return prisma.item.findUnique({ where: { id } });
}

export type DbItemDetail = NonNullable<Awaited<ReturnType<typeof getDbItemDetail>>>;
