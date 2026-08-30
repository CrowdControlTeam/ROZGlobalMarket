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
