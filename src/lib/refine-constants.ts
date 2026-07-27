// Pura y sin dependencias de servidor (a diferencia de refine.ts, que sí
// toca @/lib/prisma) para poder usarse también desde componentes cliente.
import { ItemCategory, EquipSlot } from "@prisma/client";

export const DEFAULT_MAX_REFINE_LEVEL = 10;

const REFINABLE_ARMOR_SLOTS: EquipSlot[] = [
  EquipSlot.UPPER_HEADGEAR,
  EquipSlot.ARMOR,
  EquipSlot.SHIELD,
  EquipSlot.GARMENT,
  EquipSlot.FOOTGEAR,
];

// Arma, o armadura en un slot refinable (casco superior/cuerpo/escudo/
// prenda/calzado) — cascos medio/inferior, accesorios y el resto de
// categorías no son refinables.
export function isRefineEligible(item: { category: ItemCategory; slot: EquipSlot | null }): boolean {
  if (item.category === ItemCategory.WEAPON) return true;
  return item.category === ItemCategory.ARMOR && item.slot !== null && REFINABLE_ARMOR_SLOTS.includes(item.slot);
}

// +0 nunca se prefija; a partir de +1 sí.
export function formatRefinedName(name: string, refineLevel: number): string {
  return refineLevel > 0 ? `+${refineLevel} ${name}` : name;
}
