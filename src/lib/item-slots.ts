// Puro y sin dependencias de servidor, para usarse también desde componentes
// cliente (mismo patrón que item-options-constants.ts).
import { EquipSlot, ItemCategory } from "@/db/enums";

// ¿Un item encaja en el slot de equipo dado? El arma va en WEAPON; el resto de
// slots requieren una armadura cuyo `slot` coincida (headgear unificado en
// EquipSlot). Se usa para filtrar el buscador de items por slot (mercado y, más
// adelante, el editor de builds).
export function itemFitsSlot(
  item: { category: ItemCategory; slot: EquipSlot | null },
  targetSlot: EquipSlot,
): boolean {
  return targetSlot === EquipSlot.WEAPON
    ? item.category === ItemCategory.WEAPON
    : item.category === ItemCategory.ARMOR && item.slot === targetSlot;
}

// Item.cardSlot (texto del catálogo) → EquipSlot donde encaja la carta. Las
// cartas sin cardSlot (o con uno desconocido) no encajan en ningún slot.
const CARD_SLOT_TO_EQUIP: Record<string, EquipSlot> = {
  Weapon: EquipSlot.WEAPON,
  Armor: EquipSlot.ARMOR,
  Shield: EquipSlot.SHIELD,
  Garment: EquipSlot.GARMENT,
  Shoes: EquipSlot.FOOTGEAR,
  Headgear: EquipSlot.HEADGEAR,
  Accessory: EquipSlot.ACCESSORY,
};

export function cardEquipSlot(cardSlot: string | null | undefined): EquipSlot | null {
  return cardSlot ? (CARD_SLOT_TO_EQUIP[cardSlot] ?? null) : null;
}

// ¿Una carta (por su cardSlot) encaja en el slot de equipo de un item? Se exige
// que ambos existan y coincidan (una carta de arma solo va en armas, etc.).
export function cardFitsEquipSlot(
  cardSlot: string | null | undefined,
  equipSlot: EquipSlot | null | undefined,
): boolean {
  const target = cardEquipSlot(cardSlot);
  return target !== null && !!equipSlot && target === equipSlot;
}
