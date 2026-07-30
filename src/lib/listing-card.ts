import type { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
  const [listing, agg] = await Promise.all([
    prisma.listing.findUniqueOrThrow({ where: { id: listingId }, select: { status: true } }),
    prisma.deal.groupBy({
      by: ["status"],
      where: { listingId, status: { in: ["ACCEPTED", "PENDING"] } },
      _sum: { quantity: true },
    }),
  ]);
  const sold = agg.find((a) => a.status === "ACCEPTED")?._sum.quantity ?? 0;
  const reserved = agg.find((a) => a.status === "PENDING")?._sum.quantity ?? 0;
  return { listingId, sold, reserved, status: listing.status };
}
