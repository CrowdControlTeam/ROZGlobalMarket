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

// Posición de tocado (Item.position, tokens "Upper"/"Middle"/"Lower") exigida
// por cada slot de tocado del build. El resto de slots no filtran por posición.
export type HeadgearPosition = "Upper" | "Middle" | "Lower";
export const BUILD_SLOT_POSITION: Partial<Record<BuildSlot, HeadgearPosition>> = {
  HEADGEAR_TOP: "Upper",
  HEADGEAR_MID: "Middle",
  HEADGEAR_LOW: "Lower",
};

// ¿La posición de un item (lista separada por comas, p. ej. "Middle, Lower")
// incluye la posición exigida? Sin exigencia → siempre encaja.
export function positionAllows(
  itemPosition: string | null | undefined,
  required: HeadgearPosition | undefined,
): boolean {
  if (!required) return true;
  if (!itemPosition) return false;
  return itemPosition.split(",").some((p) => p.trim() === required);
}

// Orden del paperdoll (ventana de equipo del juego), leído por filas (izq, der):
// (1) casco sup · casco medio, (2) casco inf · armadura, (3) arma · escudo,
// (4) manto · calzado, (5) accesorio izq. · accesorio der. Compartido por el
// detalle y el editor.
export const PAPERDOLL_LEFT: readonly BuildSlot[] = ["HEADGEAR_TOP", "HEADGEAR_LOW", "WEAPON", "GARMENT", "ACCESSORY_LEFT"];
export const PAPERDOLL_RIGHT: readonly BuildSlot[] = ["HEADGEAR_MID", "ARMOR", "SHIELD", "FOOTGEAR", "ACCESSORY_RIGHT"];

export const HEADGEAR_SLOTS: readonly BuildSlot[] = ["HEADGEAR_TOP", "HEADGEAR_MID", "HEADGEAR_LOW"];
export function isHeadgearSlot(slot: BuildSlot): boolean {
  return slot in BUILD_SLOT_POSITION;
}

// Posición(es) que ocupa un item (parseadas de Item.position). Un tocado ocupa
// TODAS sus posiciones a la vez (como en el juego): "Middle, Lower" → ambas.
export function parsePositions(position: string | null | undefined): HeadgearPosition[] {
  if (!position) return [];
  return position
    .split(",")
    .map((p) => p.trim())
    .filter((p): p is HeadgearPosition => p === "Upper" || p === "Middle" || p === "Lower");
}

// Slot "principal" donde se guarda un tocado = la posición más alta que ocupa
// (Upper > Middle > Lower). Así cada tocado se elige desde un único slot y las
// demás posiciones que ocupa quedan bloqueadas.
export function headgearPrimary(position: string | null | undefined): HeadgearPosition | null {
  const ps = parsePositions(position);
  if (ps.includes("Upper")) return "Upper";
  if (ps.includes("Middle")) return "Middle";
  if (ps.includes("Lower")) return "Lower";
  return null;
}

export const POSITION_TO_SLOT: Record<HeadgearPosition, BuildSlot> = {
  Upper: "HEADGEAR_TOP",
  Middle: "HEADGEAR_MID",
  Lower: "HEADGEAR_LOW",
};

export const MAX_BUILD_NAME_LENGTH = 60;
export const MAX_BUILD_NOTES_LENGTH = 500;
