// Separado de item-options.ts (que importa @/lib/prisma) para poder usarse
// también desde componentes cliente sin arrastrar código server-only al
// bundle del navegador.
import { ItemCategory, EquipSlot, ItemOptionGroup, WeaponType } from "@prisma/client";

export const MAX_OPTION_SLOTS = 3;

export type OptionSelection = { defId: string; value: number | "" };

export function emptyOptionSelections(): OptionSelection[] {
  return Array.from({ length: MAX_OPTION_SLOTS }, () => ({ defId: "", value: "" }));
}

// Punto de enganche para cuando exista el reconocimiento de item por
// captura de pantalla: construye el array de selecciones (una función que
// "setee el valor de todos los options que hagan falta de una vez") a
// partir de lo que se detecte en la imagen, listo para pasar directamente
// a setOptionSelections en el formulario.
export function buildOptionSelectionsFromDetected(
  detected: { slotIndex: number; defId: string; value: number }[],
): OptionSelection[] {
  const selections = emptyOptionSelections();
  for (const d of detected) {
    if (d.slotIndex >= 1 && d.slotIndex <= MAX_OPTION_SLOTS) {
      selections[d.slotIndex - 1] = { defId: d.defId, value: d.value };
    }
  }
  return selections;
}

// Grupo de random options al que pertenece un item, o null si no es
// elegible (headgears/shield/accessory/card/consumibles/etc., o arma sin
// weaponType clasificado todavía). Función pura: el caller carga
// magicalTypes una vez (ver loadMagicalWeaponTypes en item-options.ts para
// el lado servidor) y se lo pasa aquí.
export function getItemOptionGroup(
  item: { category: ItemCategory; slot: EquipSlot | null; weaponType: WeaponType | null },
  magicalTypes: Set<WeaponType>,
): ItemOptionGroup | null {
  if (item.category === ItemCategory.WEAPON) {
    if (!item.weaponType) return null;
    return magicalTypes.has(item.weaponType) ? "WEAPON_MAGICAL" : "WEAPON_PHYSICAL";
  }
  if (item.category === ItemCategory.ARMOR) {
    if (item.slot === EquipSlot.ARMOR) return "ARMOR";
    if (item.slot === EquipSlot.GARMENT) return "GARMENT";
    if (item.slot === EquipSlot.FOOTGEAR) return "FOOTGEAR";
  }
  return null;
}
