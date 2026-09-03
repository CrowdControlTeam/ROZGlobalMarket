import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
  sum,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  deal,
  item,
  itemOptionDef,
  listing,
  listingOption,
  listingCard,
  user,
  ItemCategory,
  type EquipSlot,
  type WeaponType,
  type ListingType,
} from "@/db/schema";

// Labels vía sortLabel(t, sort) en market-labels.ts (messages/es.json,
// namespace market.sort.*) — este array solo fija el orden y los valores
// válidos, no el texto mostrado.
// Re-exportado desde market-sort.ts (módulo sin Prisma) para que los
// componentes cliente lo importen desde ahí sin arrastrar este módulo —y el
// cliente de Prisma— al bundle del navegador. El código de servidor puede
// seguir importándolo desde "@/lib/market". MarketSort se importa además para
// uso interno (el re-export no lo trae al scope local).
export { SORT_VALUES, isMarketSort } from "@/lib/market-sort";
import type { MarketSort } from "@/lib/market-sort";
export type { MarketSort };

export type MarketFilters = {
  q?: string;
  // Filtros multi-valor: se combinan con `{ in: [...] }` (categoría X o Y). En
  // la URL viajan como CSV (category=WEAPON,ARMOR) y el servidor los parsea a
  // array validado (ver searchParamsSchema en MarketPageContent).
  category?: ItemCategory[];
  slot?: EquipSlot[];
  weaponType?: WeaponType[];
  type?: ListingType;
  // Filtro por quien publica (poster) — resuelto a un id concreto en
  // cliente vía UserPicker, no un "contiene" de texto libre, para no
  // depender de coincidencias parciales entre nombres parecidos.
  posterId?: string;
  // Conjunto de items concreto (CSV en la URL). Para "buscar todas las piezas de
  // una build" en una sola búsqueda: lista publicaciones de cualquiera de ellos.
  itemIds?: string[];
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

// El orden se aplica sobre el core query con JOIN a Item (name_* ordena por
// Item.name); el desempate por id garantiza un orden total estable para el
// cursor.
function orderByFor(sort: MarketSort): SQL[] {
  switch (sort) {
    case "oldest":
      return [asc(listing.createdAt), asc(listing.id)];
    case "price_asc":
      return [asc(listing.price), asc(listing.id)];
    case "price_desc":
      return [desc(listing.price), asc(listing.id)];
    case "name_asc":
      return [asc(item.name), asc(listing.id)];
    case "name_desc":
      return [desc(item.name), asc(listing.id)];
    case "newest":
    default:
      return [desc(listing.createdAt), asc(listing.id)];
  }
}

// Paginación por keyset (no OFFSET/LIMIT): comparamos con los valores del
// último elemento cargado en vez de contar páginas, para que el resultado
// no se descuadre si se publican o retiran items mientras se navega.
function cursorWhereFor(sort: MarketSort, cursor: Cursor | null): SQL | undefined {
  if (!cursor) return undefined;
  const createdAt = new Date(cursor.createdAt);

  switch (sort) {
    case "oldest":
      return or(
        gt(listing.createdAt, createdAt),
        and(eq(listing.createdAt, createdAt), gt(listing.id, cursor.id)),
      );
    // El cursor de una página price_asc/price_desc siempre viene de una
    // consulta que ya excluyó los TRADE (price null) — ver isPriceSort en
    // getListings —, así que cursor.price es un número real aquí.
    case "price_asc":
      return or(
        gt(listing.price, cursor.price!),
        and(eq(listing.price, cursor.price!), gt(listing.id, cursor.id)),
      );
    case "price_desc":
      return or(
        lt(listing.price, cursor.price!),
        and(eq(listing.price, cursor.price!), gt(listing.id, cursor.id)),
      );
    case "name_asc":
      return or(
        gt(item.name, cursor.name),
        and(eq(item.name, cursor.name), gt(listing.id, cursor.id)),
      );
    case "name_desc":
      return or(
        lt(item.name, cursor.name),
        and(eq(item.name, cursor.name), gt(listing.id, cursor.id)),
      );
    case "newest":
    default:
      return or(
        lt(listing.createdAt, createdAt),
        and(eq(listing.createdAt, createdAt), gt(listing.id, cursor.id)),
      );
  }
}

// Una condición por slot de option rellenado en el filtro — se combinan
// todas con AND (un listing debe cumplirlas todas a la vez), cada una vía un
// EXISTS sobre ListingOption+ItemOptionDef correlado al listing (equivale al
// `options: { some }` de Prisma; por eso son EXISTS separados y no uno solo).
function optionSlotWhere(
  slotIndex: number,
  statCode?: string,
  min?: number,
  max?: number,
): SQL | null {
  if (!statCode) return null;
  const inner: SQL[] = [
    eq(listingOption.listingId, listing.id),
    eq(listingOption.slotIndex, slotIndex),
    eq(itemOptionDef.statCode, statCode),
  ];
  if (min !== undefined) inner.push(gte(listingOption.value, min));
  if (max !== undefined) inner.push(lte(listingOption.value, max));
  return exists(
    db
      .select({ one: sql`1` })
      .from(listingOption)
      .innerJoin(itemOptionDef, eq(listingOption.defId, itemOptionDef.id))
      .where(and(...inner)),
  );
}

export async function getListings(filters: MarketFilters) {
  const cursor = decodeCursor(filters.cursor);

  // Gating "guiado no destructivo": slot solo se aplica si hay slots elegidos y
  // alguna categoría elegida es equipo/carta (o no hay categoría); tipo de arma
  // solo si hay arma (o ninguna). Un valor fuera de contexto se conserva en la
  // URL pero NO se aplica — así al volver la categoría reaparece sin haberlo
  // borrado. Con categoría múltiple basta que ALGUNA case (`some`).
  const hasCategory = (filters.category?.length ?? 0) > 0;
  const needsSlotFilter =
    (filters.slot?.length ?? 0) > 0 &&
    (!hasCategory ||
      filters.category!.some((c) => c === ItemCategory.ARMOR || c === ItemCategory.CARD));

  const needsWeaponTypeFilter =
    (filters.weaponType?.length ?? 0) > 0 &&
    (!hasCategory || filters.category!.some((c) => c === ItemCategory.WEAPON));

  const optionConditions = [
    optionSlotWhere(1, filters.option1Stat, filters.option1Min, filters.option1Max),
    optionSlotWhere(2, filters.option2Stat, filters.option2Min, filters.option2Max),
    optionSlotWhere(3, filters.option3Stat, filters.option3Min, filters.option3Max),
  ].filter((c): c is SQL => c !== null);

  const cursorCondition = cursorWhereFor(filters.sort, cursor);

  // Los listings de tipo TRADE no tienen precio (columna null) — al
  // ordenar explícitamente por precio no tiene sentido mezclarlos (no hay
  // con qué compararlos), así que se excluyen de esa vista en vez de
  // intentar resolverles una posición. Fuera de esos dos sorts, sí
  // aparecen con normalidad (recientes, nombre, etc.).
  const isPriceSort = filters.sort === "price_asc" || filters.sort === "price_desc";

  // Condiciones base (comunes a listado y count): estado + filtros de listing e
  // item. El JOIN a Item permite filtrar/ordenar por sus columnas (name/category/…).
  const baseConditions: SQL[] = [eq(listing.status, "ACTIVE")];
  // Oculta las caducadas aunque el cron aún no las haya marcado EXPIRED
  // (expiresAt null = no caduca, por diseño → se mantiene visible).
  baseConditions.push(
    or(isNull(listing.expiresAt), gt(listing.expiresAt, sql`now()`)) as SQL,
  );
  if (filters.type) baseConditions.push(eq(listing.type, filters.type));
  if (filters.posterId) baseConditions.push(eq(listing.posterId, filters.posterId));
  if (filters.itemIds && filters.itemIds.length > 0) baseConditions.push(inArray(listing.itemId, filters.itemIds));
  if (filters.minPrice !== undefined) baseConditions.push(gte(listing.price, filters.minPrice));
  if (filters.maxPrice !== undefined) baseConditions.push(lte(listing.price, filters.maxPrice));
  if (isPriceSort) baseConditions.push(isNotNull(listing.price));
  if (filters.refineMin !== undefined) baseConditions.push(gte(listing.refineLevel, filters.refineMin));
  if (filters.refineMax !== undefined) baseConditions.push(lte(listing.refineLevel, filters.refineMax));
  if (filters.q) baseConditions.push(ilike(item.name, `%${filters.q}%`));
  if (hasCategory) baseConditions.push(inArray(item.category, filters.category!));
  if (needsSlotFilter) baseConditions.push(inArray(item.slot, filters.slot!));
  if (needsWeaponTypeFilter) baseConditions.push(inArray(item.weaponType, filters.weaponType!));
  // Las ranuras son del item (Item.slotCount), no del listing.
  if (filters.cardSlotsMin !== undefined) baseConditions.push(gte(item.slotCount, filters.cardSlotsMin));
  if (filters.cardSlotsMax !== undefined) baseConditions.push(lte(item.slotCount, filters.cardSlotsMax));
  baseConditions.push(...optionConditions);

  // El listado pagina por cursor; el total (para "X de Y") cuenta lo mismo
  // pero SIN la condición de cursor — es todo lo que casa, no solo lo que
  // queda por paginar. Las condiciones de option sí van en ambos.
  const listWhere = and(...baseConditions, ...(cursorCondition ? [cursorCondition] : []));
  const countWhere = and(...baseConditions);

  // `select` acotado (no fila completa de Item con description[] y restrictions
  // JSON): la card del grid solo usa estos campos — el mayor ahorro de egress. El
  // tooltip completo se pide aparte al hacer click (fetchDbItemDetail).
  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: listing.id,
        type: listing.type,
        quantity: listing.quantity,
        price: listing.price,
        refineLevel: listing.refineLevel,
        notes: listing.notes,
        createdAt: listing.createdAt, // para el cursor de paginación
        expiresAt: listing.expiresAt, // para el indicador de caducidad (reloj)
        itemId: item.id,
        itemName: item.name,
        itemIconUrl: item.iconUrl,
        itemSlotCount: item.slotCount,
        posterId: user.id,
        posterUsername: user.username,
      })
      .from(listing)
      .innerJoin(item, eq(listing.itemId, item.id))
      .innerJoin(user, eq(listing.posterId, user.id))
      .where(listWhere)
      .orderBy(...orderByFor(filters.sort))
      .limit(PAGE_SIZE + 1),
    // El count solo en la primera página (sin cursor): al "cargar más" el total
    // no cambia, así que se devuelve null y el cliente conserva el que ya tenía.
    cursor
      ? Promise.resolve<number | null>(null)
      : db
          .select({ value: count() })
          .from(listing)
          .innerJoin(item, eq(listing.itemId, item.id))
          .where(countWhere)
          .then((r) => r[0]?.value ?? 0),
  ]);

  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const pageIds = pageRows.map((l) => l.id);

  // Options de la página en una sola consulta (el JOIN del listado se dejó plano
  // para no multiplicar filas por option). Se agrupan por listing, ya en la
  // forma que espera el grid ({ slotIndex, value, def: { label } }).
  const optionRows =
    pageIds.length > 0
      ? await db
          .select({
            listingId: listingOption.listingId,
            slotIndex: listingOption.slotIndex,
            value: listingOption.value,
            label: itemOptionDef.label,
          })
          .from(listingOption)
          .innerJoin(itemOptionDef, eq(listingOption.defId, itemOptionDef.id))
          .where(inArray(listingOption.listingId, pageIds))
          .orderBy(asc(listingOption.slotIndex))
      : [];
  const optionsByListing = new Map<string, { slotIndex: number; value: number; def: { label: string } }[]>();
  for (const o of optionRows) {
    const list = optionsByListing.get(o.listingId) ?? [];
    list.push({ slotIndex: o.slotIndex, value: o.value, def: { label: o.label } });
    optionsByListing.set(o.listingId, list);
  }

  // Cartas de la página, misma técnica que las options: una consulta con JOIN al
  // item de la carta, agrupadas por listing en la forma { slotIndex, card }.
  type CardRow = { slotIndex: number; card: { id: string; name: string; iconUrl: string } };
  const cardRows =
    pageIds.length > 0
      ? await db
          .select({
            listingId: listingCard.listingId,
            slotIndex: listingCard.slotIndex,
            cardId: item.id,
            cardName: item.name,
            cardIconUrl: item.iconUrl,
          })
          .from(listingCard)
          .innerJoin(item, eq(listingCard.cardItemId, item.id))
          .where(inArray(listingCard.listingId, pageIds))
          .orderBy(asc(listingCard.slotIndex))
      : [];
  const cardsByListing = new Map<string, CardRow[]>();
  for (const c of cardRows) {
    const list = cardsByListing.get(c.listingId) ?? [];
    list.push({ slotIndex: c.slotIndex, card: { id: c.cardId, name: c.cardName, iconUrl: c.cardIconUrl } });
    cardsByListing.set(c.listingId, list);
  }

  // Reconstrucción a la forma anidada que devolvía Prisma (item/poster/options).
  const page = pageRows.map((l) => ({
    id: l.id,
    type: l.type,
    quantity: l.quantity,
    price: l.price,
    refineLevel: l.refineLevel,
    notes: l.notes,
    createdAt: l.createdAt,
    expiresAt: l.expiresAt,
    item: { id: l.itemId, name: l.itemName, iconUrl: l.itemIconUrl, slotCount: l.itemSlotCount },
    poster: { id: l.posterId, username: l.posterUsername },
    options: optionsByListing.get(l.id) ?? [],
    cards: cardsByListing.get(l.id) ?? [],
  }));
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

  // Vendido y reservado por listing derivados de los Deal (ya no hay
  // quantitySold). Un groupBy para toda la página en vez de una consulta por
  // card. `reserved` (PENDING) permite que la card reste lo pendiente igual que
  // el detalle (en precio fijo); el grid decide si restarlo según el tipo/modo.
  const dealAgg =
    pageIds.length > 0
      ? await db
          .select({ listingId: deal.listingId, status: deal.status, quantity: sum(deal.quantity) })
          .from(deal)
          .where(and(inArray(deal.listingId, pageIds), inArray(deal.status, ["ACCEPTED", "PENDING"])))
          .groupBy(deal.listingId, deal.status)
      : [];
  const soldMap = new Map<string, number>();
  const reservedMap = new Map<string, number>();
  // Listings con algún Deal VIVO (PENDING o ACCEPTED), sea del modo que sea —a
  // diferencia de `reserved`, que es 0 en competitivo/trade aunque haya PENDING.
  // Se usa para el gate de "editar" (editable solo sin deals vivos): mode-
  // independiente, así el botón no aparece cuando el server lo rechazaría.
  const dealsMap = new Set<string>();
  for (const g of dealAgg) {
    const q = Number(g.quantity ?? 0);
    if (g.status === "ACCEPTED") soldMap.set(g.listingId, (soldMap.get(g.listingId) ?? 0) + q);
    else if (g.status === "PENDING") reservedMap.set(g.listingId, (reservedMap.get(g.listingId) ?? 0) + q);
    dealsMap.add(g.listingId);
  }
  const pageWithSold = page.map((l) => ({
    ...l,
    sold: soldMap.get(l.id) ?? 0,
    reserved: reservedMap.get(l.id) ?? 0,
    hasLiveDeals: dealsMap.has(l.id),
  }));

  return { listings: pageWithSold, nextCursor, total: totalResult };
}
