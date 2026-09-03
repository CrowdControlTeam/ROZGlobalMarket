import { cache } from "react";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { listing as listingTable } from "@/db/schema";

// Carga la ficha completa de un listing (item/poster/options/deals) para el
// detalle. Envuelto en cache() para deduplicar la query cuando el detalle y las
// acciones de cabecera (Compartir/Contactar) se renderizan en el mismo request
// (ver DetailSlot: <DetailPanel headerActions=…><ListingDetailContent/></…>).
// `columns` en las relaciones pesadas (item/offeredItem) para no traer la fila
// completa de Item (description[]/restrictions).
export const getListingDetail = cache((id: string) =>
  db.query.listing.findFirst({
    where: eq(listingTable.id, id),
    with: {
      item: { columns: { id: true, name: true, iconUrl: true, slotCount: true } },
      poster: { columns: { id: true, username: true } },
      options: { with: { def: true }, orderBy: (o) => asc(o.slotIndex) },
      cards: {
        with: { card: { columns: { id: true, name: true, iconUrl: true, slotCount: true } } },
        orderBy: (c) => asc(c.slotIndex),
      },
      deals: {
        with: {
          user: { columns: { id: true, username: true } },
          offeredItem: { columns: { id: true, name: true, iconUrl: true, slotCount: true } },
        },
        orderBy: (d) => desc(d.createdAt),
      },
    },
  }),
);
