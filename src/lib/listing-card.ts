import { and, eq, inArray, sum } from "drizzle-orm";
import { db } from "@/db";
import { deal, listing as listingTable, type ListingStatus } from "@/db/schema";

// Estado "de card" de un listing: lo que el grid necesita para reflejar una
// mutación sin recargar (ver src/app/market/listingStore.ts). Las server actions
// de compra/venta/oferta lo DEVUELVEN al terminar, así el cliente parchea la
// card afectada con el mismo round-trip de la acción (sin consulta extra).
export type ListingCardPatch = {
  listingId: string;
  // Σ cantidad de los Deal ACCEPTED / PENDING (ver deals.ts). El grid recalcula
  // el disponible a partir de estos + la cantidad y el tipo.
  sold: number;
  reserved: number;
  // Si deja de ser ACTIVE (COMPLETED/CANCELLED), el grid quita la card.
  status: ListingStatus;
};

// Se llama tras la transacción de la acción (lee ya comprometido). Un groupBy
// por estado + el status del listing; es el mismo dato que ya deriva el resto
// del rediseño, no un contador denormalizado.
export async function listingCardState(listingId: string): Promise<ListingCardPatch> {
  const [listingRows, agg] = await Promise.all([
    db
      .select({ status: listingTable.status })
      .from(listingTable)
      .where(eq(listingTable.id, listingId))
      .limit(1),
    db
      .select({ status: deal.status, quantity: sum(deal.quantity) })
      .from(deal)
      .where(and(eq(deal.listingId, listingId), inArray(deal.status, ["ACCEPTED", "PENDING"])))
      .groupBy(deal.status),
  ]);
  const listing = listingRows[0];
  if (!listing) throw new Error(`Listing ${listingId} no encontrado`);
  // sum() de Drizzle devuelve string | null (numeric de Postgres).
  const sold = Number(agg.find((a) => a.status === "ACCEPTED")?.quantity ?? 0);
  const reserved = Number(agg.find((a) => a.status === "PENDING")?.quantity ?? 0);
  return { listingId, sold, reserved, status: listing.status };
}
