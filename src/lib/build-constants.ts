// Puro y sin dependencias de servidor (client-safe), como item-slots.ts.
import { BuildSlot, EquipSlot } from "@/db/enums";

// Los 10 slots de una build, en orden de paperdoll (fila superior tocados, luego
// el resto). Cada BuildSlot mapea al EquipSlot con el que se filtran los items
// (3 tocados → HEADGEAR; 2 accesorios → ACCESSORY).
export const BUILD_SLOTS: readonly BuildSlot[] = [
  "HEADGEAR_TOP",
  "HEADGEAR_MID",
  "HEADGEAR_LOW",
  "ARMOR",
  "WEAPON",
  "SHIELD",
  "GARMENT",
  "FOOTGEAR",
  "ACCESSORY_LEFT",
  "ACCESSORY_RIGHT",
];

const BUILD_SLOT_TO_EQUIP: Record<BuildSlot, EquipSlot> = {
  HEADGEAR_TOP: EquipSlot.HEADGEAR,
  HEADGEAR_MID: EquipSlot.HEADGEAR,
  HEADGEAR_LOW: EquipSlot.HEADGEAR,
  ARMOR: EquipSlot.ARMOR,
  WEAPON: EquipSlot.WEAPON,
  SHIELD: EquipSlot.SHIELD,
  GARMENT: EquipSlot.GARMENT,
  FOOTGEAR: EquipSlot.FOOTGEAR,
  ACCESSORY_LEFT: EquipSlot.ACCESSORY,
  ACCESSORY_RIGHT: EquipSlot.ACCESSORY,
};

export function buildSlotToEquipSlot(slot: BuildSlot): EquipSlot {
  return BUILD_SLOT_TO_EQUIP[slot];
}

export const MAX_BUILD_NAME_LENGTH = 60;
export const MAX_BUILD_NOTES_LENGTH = 500;
