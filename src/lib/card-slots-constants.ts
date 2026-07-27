// Pura y sin dependencias de servidor, mismo patrón que refine-constants.ts
// — usable también desde componentes cliente. A diferencia del refine, no
// hay tope configurable en base de datos: son reglas fijas por categoría,
// sin perseguir precisión item a item (dos items del mismo nombre pueden
// existir en versión con y sin slot en RO real; no lo modelamos aquí).
import { ItemCategory, EquipSlot } from "@prisma/client";

export const MAX_WEAPON_CARD_SLOTS = 4;
export const MAX_ARMOR_CARD_SLOTS = 1;

// Único caso que se trata distinto dentro de armadura: el casco inferior
// prácticamente nunca lleva slot en RO clásico.
export function getMaxCardSlots(item: { category: ItemCategory; slot: EquipSlot | null }): number {
  if (item.category === ItemCategory.WEAPON) return MAX_WEAPON_CARD_SLOTS;
  if (item.category === ItemCategory.ARMOR) {
    return item.slot === EquipSlot.LOWER_HEADGEAR ? 0 : MAX_ARMOR_CARD_SLOTS;
  }
  return 0;
}

export function isCardSlotEligible(item: { category: ItemCategory; slot: EquipSlot | null }): boolean {
  return getMaxCardSlots(item) > 0;
}

// Prefijo de refine (con espacio) + sufijo de slots (pegado, sin espacio),
// combinables entre sí: "+7 Silk Robe[1]". Ninguno se muestra si es 0.
export function formatItemDisplayName(name: string, refineLevel: number, cardSlots: number): string {
  const prefix = refineLevel > 0 ? `+${refineLevel} ` : "";
  const suffix = cardSlots > 0 ? `[${cardSlots}]` : "";
  return `${prefix}${name}${suffix}`;
}
