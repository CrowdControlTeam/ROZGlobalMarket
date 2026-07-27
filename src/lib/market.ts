import { Prisma, ItemCategory, EquipSlot, WeaponType, ListingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Labels vía sortLabel(t, sort) en market-labels.ts (messages/es.json,
// namespace market.sort.*) — este array solo fija el orden y los valores
// válidos, no el texto mostrado.
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

export type MarketFilters = {
  q?: string;
  category?: ItemCategory;
  slot?: EquipSlot;
  weaponType?: WeaponType;
  type?: ListingType;
  // Filtro por quien publica (poster) — resuelto a un id concreto en
  // cliente vía UserPicker, no un "contiene" de texto libre, para no
  // depender de coincidencias parciales entre nombres parecidos.
  posterId?: string;
  // Filtro por random option, uno por slot posicional (1..MAX_OPTION_SLOTS
  // — ver src/lib/item-options-constants.ts). Filtra por statCode, no por
  // defId: la misma stat (p.ej. MaxHP %) existe como filas de
  // ItemOptionDef distintas en cada grupo (armadura/prenda/calzado/arma),
  // y aquí interesa "cualquier equipo con esta stat en esta posición",
  // sin exigir elegir antes una categoría/slot/tipo de arma concretos.
  option1Stat?: string;
  option1Min?: number;
  option1Max?: number;
  option2Stat?: string;
  option2Min?: number;
  option2Max?: number;
  option3Stat?: string;
  option3Min?: number;
  option3Max?: number;
  refineMin?: number;
  refineMax?: number;
  cardSlotsMin?: number;
  cardSlotsMax?: number;
  minPrice?: number;
  maxPrice?: number;
  sort: MarketSort;
  cursor?: string;
};

type Cursor = {
  id: string;
  // null quiere decir que el último listing cargado es un TRADE (sin
  // precio) — solo pasa con sort=newest/oldest/name_*, ya que los sorts
  // por precio excluyen los TRADE de la consulta (ver isPriceSort en
  // getListings), así que ahí siempre llega un número real.
  price: number | null;
  name: string;
  createdAt: string; // ISO
};

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
    if (
      typeof parsed?.id === "string" &&
      (typeof parsed?.price === "number" || parsed?.price === null) &&
      typeof parsed?.name === "string" &&
      typeof parsed?.createdAt === "string"
    ) {
      return parsed as Cursor;
    }
    return null;
  } catch {
    return null;
  }
}

const PAGE_SIZE = 20;

function orderByFor(sort: MarketSort): Prisma.ListingOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "price_asc":
      return [{ price: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ price: "desc" }, { id: "asc" }];
    case "name_asc":
      return [{ item: { name: "asc" } }, { id: "asc" }];
    case "name_desc":
      return [{ item: { name: "desc" } }, { id: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

// Paginación por keyset (no OFFSET/LIMIT): comparamos con los valores del
// último elemento cargado en vez de contar páginas, para que el resultado
// no se descuadre si se publican o retiran items mientras se navega.
function cursorWhereFor(
  sort: MarketSort,
  cursor: Cursor | null,
): Prisma.ListingWhereInput | undefined {
  if (!cursor) return undefined;

  switch (sort) {
    case "oldest":
      return {
        OR: [
          { createdAt: { gt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { gt: cursor.id } },
        ],
      };
    // El cursor de una página price_asc/price_desc siempre viene de una
    // consulta que ya excluyó los TRADE (price null) — ver isPriceSort en
    // getListings —, así que cursor.price es un número real aquí.
    case "price_asc":
      return {
        OR: [
          { price: { gt: cursor.price! } },
          { price: cursor.price, id: { gt: cursor.id } },
        ],
      };
    case "price_desc":
      return {
        OR: [
          { price: { lt: cursor.price! } },
          { price: cursor.price, id: { gt: cursor.id } },
        ],
      };
    case "name_asc":
      return {
        OR: [
          { item: { name: { gt: cursor.name } } },
          { item: { name: cursor.name }, id: { gt: cursor.id } },
        ],
      };
    case "name_desc":
      return {
        OR: [
          { item: { name: { lt: cursor.name } } },
          { item: { name: cursor.name }, id: { gt: cursor.id } },
        ],
      };
    case "newest":
    default:
      return {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { gt: cursor.id } },
        ],
      };
  }
}

// Una condición por slot de option rellenado en el filtro — se combinan
// todas con AND (un listing debe cumplirlas todas a la vez), cada una
// buscando en una fila de ListingOption distinta (por eso son "some"
// separados y no uno solo con varias condiciones dentro).
function optionSlotWhere(
  slotIndex: number,
  statCode?: string,
  min?: number,
  max?: number,
): Prisma.ListingWhereInput | null {
  if (!statCode) return null;
  return {
    options: {
      some: {
        slotIndex,
        def: { statCode },
        ...(min !== undefined || max !== undefined
          ? {
              value: {
                ...(min !== undefined ? { gte: min } : {}),
                ...(max !== undefined ? { lte: max } : {}),
              },
            }
          : {}),
      },
    },
  };
}

export async function getListings(filters: MarketFilters) {
  const cursor = decodeCursor(filters.cursor);

  const needsSlotFilter =
    filters.slot &&
    (filters.category === ItemCategory.ARMOR ||
      filters.category === ItemCategory.CARD ||
      !filters.category);

  const needsWeaponTypeFilter =
    filters.weaponType &&
    (filters.category === ItemCategory.WEAPON || !filters.category);

  const optionConditions = [
    optionSlotWhere(1, filters.option1Stat, filters.option1Min, filters.option1Max),
    optionSlotWhere(2, filters.option2Stat, filters.option2Min, filters.option2Max),
    optionSlotWhere(3, filters.option3Stat, filters.option3Min, filters.option3Max),
  ].filter((c): c is Prisma.ListingWhereInput => c !== null);

  const cursorCondition = cursorWhereFor(filters.sort, cursor);
  const andConditions = [...(cursorCondition ? [cursorCondition] : []), ...optionConditions];

  // Los listings de tipo TRADE no tienen precio (columna null) — al
  // ordenar explícitamente por precio no tiene sentido mezclarlos (no hay
  // con qué compararlos), así que se excluyen de esa vista en vez de
  // intentar resolverles una posición. Fuera de esos dos sorts, sí
  // aparecen con normalidad (recientes, nombre, etc.).
  const isPriceSort = filters.sort === "price_asc" || filters.sort === "price_desc";
  const priceFilter = {
    ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
    ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
    ...(isPriceSort ? { not: null } : {}),
  };

  const where: Prisma.ListingWhereInput = {
    status: "ACTIVE",
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.posterId ? { posterId: filters.posterId } : {}),
    ...(Object.keys(priceFilter).length > 0 ? { price: priceFilter } : {}),
    ...(filters.refineMin !== undefined || filters.refineMax !== undefined
      ? {
          refineLevel: {
            ...(filters.refineMin !== undefined ? { gte: filters.refineMin } : {}),
            ...(filters.refineMax !== undefined ? { lte: filters.refineMax } : {}),
          },
        }
      : {}),
    ...(filters.cardSlotsMin !== undefined || filters.cardSlotsMax !== undefined
      ? {
          cardSlots: {
            ...(filters.cardSlotsMin !== undefined ? { gte: filters.cardSlotsMin } : {}),
            ...(filters.cardSlotsMax !== undefined ? { lte: filters.cardSlotsMax } : {}),
          },
        }
      : {}),
    item: {
      ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" } } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(needsSlotFilter ? { slot: filters.slot } : {}),
      ...(needsWeaponTypeFilter ? { weaponType: filters.weaponType } : {}),
    },
    ...(andConditions.length > 0 ? { AND: andConditions } : {}),
  };

  const listings = await prisma.listing.findMany({
    where,
    orderBy: orderByFor(filters.sort),
    take: PAGE_SIZE + 1,
    include: {
      item: true,
      poster: true,
      options: { include: { def: true }, orderBy: { slotIndex: "asc" } },
    },
  });

  const hasMore = listings.length > PAGE_SIZE;
  const page = hasMore ? listings.slice(0, PAGE_SIZE) : listings;
  const last = page.at(-1);

  const nextCursor =
    hasMore && last
      ? encodeCursor({
          id: last.id,
          price: last.price,
          name: last.item.name,
          createdAt: last.createdAt.toISOString(),
        })
      : null;

  return { listings: page, nextCursor };
}
