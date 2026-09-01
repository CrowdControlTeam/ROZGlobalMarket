import { eq } from "drizzle-orm";
import { db } from "@/db";
import { item as itemTable, user as userTable } from "@/db/schema";
import { requireSession } from "@/lib/guard";
import { getItemOptionGroup, loadMagicalWeaponTypes, isOptionsFeatureAvailable } from "@/lib/item-options";
import { buildOptionSelectionsFromDetected, MAX_OPTION_SLOTS } from "@/lib/item-options-constants";
import { isImageRecognitionAvailable } from "@/lib/item-recognition";
import { PublishModal } from "../PublishModal";
import { isPublicationType } from "../publication-type";
import type { EditListingData } from "../PublishForm";
import type { ItemResult } from "../ItemPicker";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Slot @publish: modal de "Publicar" interceptado sobre el mercado, activado por
// ?publish=<tipo>. Si además llega ?item=<id> (p. ej. desde una pieza de build),
// se precarga el item con su refino y options (?refine, ?option{n}DefId/Value) y,
// opcionalmente, el destinatario del regalo (?recipient=<userId>).
export async function PublishSlot({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const value = first(raw.publish);
  if (!value) return null;

  const initialType = isPublicationType(value) ? value : "SALE";
  const itemId = first(raw.item);

  // Publicar normal (sin precarga): buscador + escáner.
  if (!itemId) {
    const recognitionEnabled = await isImageRecognitionAvailable();
    return <PublishModal recognitionEnabled={recognitionEnabled} initialType={initialType} />;
  }

  // Precarga desde una pieza de build.
  await requireSession();
  const itemRow = await db.query.item.findFirst({ where: eq(itemTable.id, itemId) });
  if (!itemRow) {
    const recognitionEnabled = await isImageRecognitionAvailable();
    return <PublishModal recognitionEnabled={recognitionEnabled} initialType={initialType} />;
  }

  const [magicalTypes, optionsAvailable] = await Promise.all([
    loadMagicalWeaponTypes(),
    isOptionsFeatureAvailable(),
  ]);
  const seedItem: ItemResult = {
    id: itemRow.id,
    name: itemRow.name,
    iconUrl: itemRow.iconUrl,
    category: itemRow.category,
    slot: itemRow.slot,
    weaponType: itemRow.weaponType,
    slotCount: itemRow.slotCount,
    optionGroup: optionsAvailable ? getItemOptionGroup(itemRow, magicalTypes) : null,
  };

  const detected: { slotIndex: number; defId: string; value: number }[] = [];
  for (let n = 1; n <= MAX_OPTION_SLOTS; n++) {
    const defId = first(raw[`option${n}DefId`]);
    const val = first(raw[`option${n}Value`]);
    if (defId && val !== undefined && Number.isInteger(Number(val))) {
      detected.push({ slotIndex: n, defId, value: Number(val) });
    }
  }

  const refine = Number(first(raw.refine) ?? 0);
  const seedListing: EditListingData = {
    id: "",
    type: initialType,
    item: seedItem,
    quantity: 1,
    price: null,
    refineLevel: Number.isInteger(refine) && refine > 0 ? refine : 0,
    notes: "",
    optionSelections: buildOptionSelectionsFromDetected(detected),
  };

  // Destinatario del regalo precargado (dueño de la build): por si se publica
  // como regalo para esa persona.
  const recipientId = first(raw.recipient);
  let seedRecipient: { id: string; username: string; avatarUrl: string | null } | undefined;
  if (recipientId) {
    const [u] = await db
      .select({ id: userTable.id, username: userTable.username, avatarUrl: userTable.avatarUrl })
      .from(userTable)
      .where(eq(userTable.id, recipientId))
      .limit(1);
    if (u) seedRecipient = u;
  }

  return (
    <PublishModal
      recognitionEnabled={false}
      initialType={initialType}
      seedListing={seedListing}
      seedRecipient={seedRecipient}
    />
  );
}
