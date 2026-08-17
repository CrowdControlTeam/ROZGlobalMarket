import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { getItemOptionGroup, loadMagicalWeaponTypes, isOptionsFeatureAvailable } from "@/lib/item-options";
import { buildOptionSelectionsFromDetected } from "@/lib/item-options-constants";
import { PublishModal } from "../PublishModal";
import type { EditListingData } from "../PublishForm";
import type { ItemResult } from "../ItemPicker";

// Slot @repost: modal de "Republicar" interceptado sobre el mercado, por el query
// param ?repost=<listingId> (mismo patrón que @edit/@publish). Carga una
// publicación PROPIA y reutiliza el modal de publicar con TODOS los datos
// precargados para crear una NUEVA (createListing). A diferencia de @edit: no
// bloquea tipo/item ni exige que sea editable — se ofrece en las publicaciones NO
// activas. Si no existe o no es del usuario, no renderiza nada (el modal no sale).
export async function RepostSlot({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const listingId = Array.isArray(raw.repost) ? raw.repost[0] : raw.repost;
  if (!listingId) return null;

  const session = await requireSession();

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { item: true, options: { orderBy: { slotIndex: "asc" } } },
  });

  if (!listing || listing.posterId !== session.user.discordId) return null;

  const [magicalTypes, optionsAvailable] = await Promise.all([
    loadMagicalWeaponTypes(),
    isOptionsFeatureAvailable(),
  ]);

  // Mismo shape que devuelve searchItems (CatalogItem + optionGroup derivado),
  // para que el ItemPicker/PublishForm lo traten igual que un item del buscador.
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

  // Reutiliza EditListingData como semilla de precarga; en republicar el `id` no
  // se usa (createListing crea una publicación nueva), solo los campos.
  const repostListing: EditListingData = {
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

  // Sin escáner: los datos ya vienen precargados (modal de una columna, como @edit).
  return <PublishModal recognitionEnabled={false} initialType={repostListing.type} repostListing={repostListing} />;
}
