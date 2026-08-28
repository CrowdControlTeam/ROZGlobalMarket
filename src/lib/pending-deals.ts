import { cache } from "react";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { deal, listing } from "@/db/schema";
import { requireSession } from "@/lib/guard";

// Nº de ofertas ENTRANTES pendientes: Deal PENDING sobre las publicaciones del
// usuario (reservas/ofertas/reclamaciones que esperan que ÉL responda). Es el
// número "accionable" del badge de Mi actividad. Se envuelve en cache() de React
// para dedup por request: el layout de mercado y el de actividad lo piden ambos y
// solo se consulta una vez.
export const countMyPendingDeals = cache(async (): Promise<number> => {
  const session = await requireSession();
  const [row] = await db
    .select({ n: count() })
    .from(deal)
    .where(
      and(
        eq(deal.status, "PENDING"),
        inArray(
          deal.listingId,
          db.select({ id: listing.id }).from(listing).where(eq(listing.posterId, session.user.discordId)),
        ),
      ),
    );
  return row?.n ?? 0;
});
