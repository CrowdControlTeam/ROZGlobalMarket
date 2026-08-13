import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { getItemOptionGroup, loadMagicalWeaponTypes, isOptionsFeatureAvailable } from "@/lib/item-options";
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

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      item: true,
      options: { orderBy: { slotIndex: "asc" } },
      // Solo deals VIVOS (PENDING/ACCEPTED): si hay alguno, no es editable. Es
      // la misma regla que aplica updateListing (autoritativa) en el servidor.
      _count: { select: { deals: { where: { status: { in: ["PENDING", "ACCEPTED"] } } } } },
    },
  });

  if (
    !listing ||
    listing.posterId !== session.user.discordId ||
    listing.status !== "ACTIVE" ||
    listing._count.deals > 0
  ) {
    return null;
  }

  const [magicalTypes, optionsAvailable] = await Promise.all([
    loadMagicalWeaponTypes(),
    isOptionsFeatureAvailable(),
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
  };

  // Sin escáner en edición (recognitionEnabled=false → modal de una columna).
  return <PublishModal recognitionEnabled={false} initialType={editListing.type} editListing={editListing} />;
}
