import { requireSession } from "@/lib/guard";
import { isDmFeatureAvailable } from "@/lib/discord-bot";
import { getListingDetail } from "@/lib/listing-detail";
import { ListingActionButtons } from "./ListingActionButtons";

// Acciones de cabecera del detalle (Compartir / Contactar), pensadas para ir en
// la fila de la X del DetailPanel (esquina derecha) y junto al "← Volver" en la
// página directa. Server component: resuelve sesión, disponibilidad del bot de
// DMs y el listing (getListingDetail va con cache(), así comparte la query con
// ListingDetailContent en el mismo request).
export async function DetailHeaderActions({ id }: { id: string }) {
  const [session, dmAvailable, listing] = await Promise.all([
    requireSession(),
    isDmFeatureAvailable(),
    getListingDetail(id),
  ]);
  if (!listing) return null;
  return (
    <ListingActionButtons
      listingId={listing.id}
      item={listing.item}
      poster={listing.poster}
      currentUserId={session.user.discordId}
      dmAvailable={dmAvailable}
    />
  );
}
