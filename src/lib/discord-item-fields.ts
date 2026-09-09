import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { itemOptionDef, listingCard, listingOption } from "@/db/schema";
import { getItemDisplay } from "@/lib/item-store";
import { formatOptionAmount } from "@/lib/market-labels";

type EmbedField = { name: string; value: string; inline: boolean };
type Translate = (key: string) => string;

// Campos de embed (Discord) para las OPTIONS y CARTAS de un item publicado.
// Vacío si no tiene ninguna. Reutilizado por el webhook del canal (que ya tiene
// los datos en memoria) y por los DMs del bot (que los cargan aparte). `isBuy`
// hace que las options se muestren como mínimos ("≥"), igual que en la ficha.
export function itemDetailFields(
  tField: Translate,
  options: { label: string; value: number }[],
  cards: { name: string }[],
  isBuy: boolean,
): EmbedField[] {
  const fields: EmbedField[] = [];
  if (options.length > 0) {
    fields.push({
      name: tField("options"),
      value: options.map((o) => `${o.label}: ${formatOptionAmount(o.value, isBuy)}`).join("\n"),
      inline: false,
    });
  }
  if (cards.length > 0) {
    fields.push({ name: tField("cards"), value: cards.map((c) => c.name).join("\n"), inline: false });
  }
  return fields;
}

// Carga options + cartas de un listing y devuelve los campos ya formateados.
// Para los DMs (best-effort), cuya query principal no trae estos datos. Una sola
// ida extra por DM; si algo falla, el llamador ya está fuera de la transacción.
export async function listingItemDetailFields(
  tField: Translate,
  listingId: string,
  isBuy: boolean,
): Promise<EmbedField[]> {
  const [options, cardLinks] = await Promise.all([
    db
      .select({ label: itemOptionDef.label, value: listingOption.value })
      .from(listingOption)
      .innerJoin(itemOptionDef, eq(listingOption.defId, itemOptionDef.id))
      .where(eq(listingOption.listingId, listingId))
      .orderBy(asc(listingOption.slotIndex)),
    // Solo la relación; el nombre de cada carta se resuelve en memoria (item-store).
    db
      .select({ cardItemId: listingCard.cardItemId })
      .from(listingCard)
      .where(eq(listingCard.listingId, listingId))
      .orderBy(asc(listingCard.slotIndex)),
  ]);
  const cards = cardLinks.map((c) => ({ name: getItemDisplay(c.cardItemId).name }));
  return itemDetailFields(tField, options, cards, isBuy);
}
