// Construye los `slots` que precargan el editor de builds (BuildEditor) a partir
// de las entries de una build. Compartido por la página de EDITAR y por la de
// DUPLICAR (crear precargado). Server-only (usa item-options), no "use server":
// es un helper, no una server action.
import { getItemOptionGroup, loadMagicalWeaponTypes } from "@/lib/item-options";
import { MAX_OPTION_SLOTS, emptyOptionSelections } from "@/lib/item-options-constants";
import type { BuildSlot } from "@/db/enums";
import type { BuildEditorInitial } from "@/app/builds/BuildEditor";
import type { getBuildForDuplicate } from "@/lib/builds";

type BuildRow = NonNullable<Awaited<ReturnType<typeof getBuildForDuplicate>>>;

export async function toEditorSlots(entries: BuildRow["entries"]): Promise<BuildEditorInitial["slots"]> {
  const magicalTypes = await loadMagicalWeaponTypes();
  const slots: BuildEditorInitial["slots"] = {};
  for (const e of entries) {
    const options = emptyOptionSelections();
    for (const o of e.options) {
      if (o.slotIndex >= 1 && o.slotIndex <= MAX_OPTION_SLOTS) {
        options[o.slotIndex - 1] = { defId: o.defId, value: o.value };
      }
    }
    const cards: ({ id: string; name: string; iconUrl: string } | null)[] = Array.from(
      { length: e.item.slotCount },
      () => null,
    );
    for (const c of e.cards) {
      if (c.slotIndex >= 0 && c.slotIndex < cards.length) {
        cards[c.slotIndex] = { id: c.card.id, name: c.card.name, iconUrl: c.card.iconUrl };
      }
    }
    slots[e.slot as BuildSlot] = {
      item: {
        id: e.item.id,
        name: e.item.name,
        iconUrl: e.item.iconUrl,
        slotCount: e.item.slotCount,
        optionGroup: getItemOptionGroup(e.item, magicalTypes),
        position: e.item.position,
        category: e.item.category,
        weaponType: e.item.weaponType,
      },
      refine: e.refineLevel,
      options,
      cards,
    };
  }
  return slots;
}
