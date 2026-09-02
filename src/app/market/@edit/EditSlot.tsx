import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { deal, listing as listingTable } from "@/db/schema";
import { requireSession } from "@/lib/guard";
import { getItemOptionGroup, loadMagicalWeaponTypes, isOptionsFeatureAvailable } from "@/lib/item-options";
import { isImageRecognitionAvailable } from "@/lib/item-recognition";
import { buildOptionSelectionsFromDetected } from "@/lib/item-options-constants";
import { PublishModal } from "../PublishModal";
import type { EditListingData } from "../PublishForm";
import type { ItemResult } from "../ItemPicker";

// Slot @edit: modal de EDITAR publicación interceptado sobre el mercado, por el
// query param ?edit=<listingId> (mismo patrón que @publish/@detail). Carga el
// listing en el servidor, comprueba que es editable (del usuario, ACTIVE y SIN
// deals vivos) y reutiliza el modal de publicar en modo edición. Si no es
// editable (o no existe), no renderiza nada — el modal simplemente no aparece.
export async function EditSlot({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const listingId = Array.isArray(raw.edit) ? raw.edit[0] : raw.edit;
  if (!listingId) return null;

  const session = await requireSession();

  const listing = await db.query.listing.findFirst({
    where: eq(listingTable.id, listingId),
    with: {
      item: true,
      options: { orderBy: (o) => asc(o.slotIndex) },
      cards: {
        with: { card: { columns: { id: true, name: true, iconUrl: true } } },
        orderBy: (c) => asc(c.slotIndex),
      },
    },
  });

  if (!listing || listing.posterId !== session.user.discordId || listing.status !== "ACTIVE") {
    return null;
  }

  // Solo deals VIVOS (PENDING/ACCEPTED): si hay alguno, no es editable. Es la
  // misma regla que aplica updateListing (autoritativa) en el servidor.
  const [{ live } = { live: 0 }] = await db
    .select({ live: count() })
    .from(deal)
    .where(and(eq(deal.listingId, listingId), inArray(deal.status, ["PENDING", "ACCEPTED"])));
  if (live > 0) return null;

  const [magicalTypes, optionsAvailable, recognitionEnabled] = await Promise.all([
    loadMagicalWeaponTypes(),
    isOptionsFeatureAvailable(),
    isImageRecognitionAvailable(),
  ]);

  // Mismo shape que devuelve searchItems (CatalogItem + optionGroup derivado),
  // para que el ItemPicker/PublishForm lo traten igual que un item recién
  // elegido del buscador.
  const item: ItemResult = {
    id: listing.item.id,
    name: listing.item.name,
    iconUrl: listing.item.iconUrl,
    category: listing.item.category,
    slot: listing.item.slot,
    weaponType: listing.item.weaponType,
    slotCount: listing.item.slotCount,
    optionGroup: optionsAvailable ? getItemOptionGroup(listing.item, magicalTypes) : null,
  };

  const editListing: EditListingData = {
    id: listing.id,
    type: listing.type,
    item,
    quantity: listing.quantity, // null = ilimitado
    price: listing.price, // null = sin precio (SALE/BUY) o no aplica (TRADE/GIFT)
    refineLevel: listing.refineLevel,
    notes: listing.notes ?? "",
    optionSelections: buildOptionSelectionsFromDetected(
      listing.options.map((o) => ({ slotIndex: o.slotIndex, defId: o.defId, value: o.value })),
    ),
    cards: listing.cards.map((c) => ({ slotIndex: c.slotIndex, card: c.card })),
  };

  // Editar = mismo modal que crear: con escáner (si está disponible) e item
  // editable; solo el TIPO queda fijo (ver PublishForm).
  return <PublishModal recognitionEnabled={recognitionEnabled} initialType={editListing.type} editListing={editListing} />;
}
