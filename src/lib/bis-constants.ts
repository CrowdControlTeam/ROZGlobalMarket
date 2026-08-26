// Puro y sin dependencias de servidor (a diferencia de bis.ts, que importa
// prisma/auth), para poder usarse también desde componentes cliente — mismo
// patrón que item-options-constants.ts.
import { EquipSlot, ItemCategory, ItemOptionGroup } from "@/db/enums";

// Grupo de random options fijado SOLO por el slot de equipo, para BiS
// "genéricos" (cualquier pieza con estas options) donde no hay un item concreto
// del que deducir el grupo. Solo armadura/manto/calzado tienen un grupo
// determinado por el slot; cascos/escudo/accesorio no llevan options (→ null) y
// el arma depende del tipo (físico/mágico), que se elige en el formulario.
export function optionGroupForSlot(slot: EquipSlot): ItemOptionGroup | null {
  switch (slot) {
    case EquipSlot.ARMOR:
      return ItemOptionGroup.ARMOR;
    case EquipSlot.GARMENT:
      return ItemOptionGroup.GARMENT;
    case EquipSlot.FOOTGEAR:
      return ItemOptionGroup.FOOTGEAR;
    default:
      return null;
  }
}

// ¿El slot admite modo genérico ("cualquiera con estas options")? Los que
// tienen pool por slot, o el arma (que resuelve el pool con el toggle
// físico/mágico). El resto (cascos/escudo/accesorio) solo item concreto.
export function slotSupportsGeneric(slot: EquipSlot): boolean {
  return slot === EquipSlot.WEAPON || optionGroupForSlot(slot) !== null;
}

// ¿Un item encaja en el slot de equipo dado? El arma va en WEAPON; el resto de
// slots requieren una armadura cuyo `slot` coincida (headgear unificado). Mismo
// criterio que valida bis-actions al guardar — se usa además para filtrar el
// buscador de items de BiS por slot.
export function itemFitsSlot(
  item: { category: ItemCategory; slot: EquipSlot | null },
  targetSlot: EquipSlot,
): boolean {
  return targetSlot === EquipSlot.WEAPON
    ? item.category === ItemCategory.WEAPON
    : item.category === ItemCategory.ARMOR && item.slot === targetSlot;
}
