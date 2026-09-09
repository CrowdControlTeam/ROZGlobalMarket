import { cache } from "react";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { listing as listingTable } from "@/db/schema";
import { getItemDisplay } from "@/lib/item-store";

// Carga la ficha completa de un listing (item/poster/options/deals) para el
// detalle. Envuelto en cache() para deduplicar la query cuando el detalle y las
// acciones de cabecera (Compartir/Contactar) se renderizan en el mismo request
// (ver DetailSlot: <DetailPanel headerActions=…><ListingDetailContent/></…>).
// El item, las cartas y el item ofrecido en cada deal se resuelven en memoria
// (item-store) por id — los items no viven en la BD.
export const getListingDetail = cache(async (id: string) => {
  const row = await db.query.listing.findFirst({
    where: eq(listingTable.id, id),
    with: {
      poster: { columns: { id: true, username: true } },
      options: { with: { def: true }, orderBy: (o) => asc(o.slotIndex) },
      cards: { orderBy: (c) => asc(c.slotIndex) },
      deals: {
        with: { user: { columns: { id: true, username: true } } },
        orderBy: (d) => desc(d.createdAt),
      },
    },
  });
  if (!row) return null;
  return {
    ...row,
    item: getItemDisplay(row.itemId),
    cards: row.cards.map((c) => ({ ...c, card: getItemDisplay(c.cardItemId) })),
    deals: row.deals.map((d) => ({
      ...d,
      offeredItem: d.offeredItemId ? getItemDisplay(d.offeredItemId) : null,
    })),
  };
});
