// Puro y sin dependencias de servidor, para usarse también desde componentes
// cliente (mismo patrón que item-options-constants.ts).
import { EquipSlot, ItemCategory, WeaponType } from "@/db/enums";

// Armas de dos manos: ocupan las dos manos, así que nunca van en la off-hand ni
// permiten dual wield. El resto de armas (con weaponType conocido) son de una
// mano. Se lista el conjunto de dos manos (más pequeño y estable) y todo lo demás
// se considera de una mano.
const TWO_HAND_WEAPON_TYPES: ReadonlySet<WeaponType> = new Set<WeaponType>([
  WeaponType.TWO_HAND_SWORD,
  WeaponType.TWO_HAND_SPEAR,
  WeaponType.TWO_HAND_AXE,
  WeaponType.TWO_HAND_ROD,
  WeaponType.BOW,
  WeaponType.KATAR,
  WeaponType.RIFLE,
  WeaponType.GATLING_GUN,
  WeaponType.SHOTGUN,
  WeaponType.GRENADE_LAUNCHER,
  WeaponType.FUUMA_SHURIKEN,
]);

// ¿Es un arma de una mano? (categoría WEAPON con un weaponType conocido que no
// sea de dos manos). Se usa para el dual wield: la off-hand solo admite armas de
// una mano.
export function isOneHandWeapon(item: {
  category: ItemCategory;
  weaponType: WeaponType | null;
}): boolean {
  return (
    item.category === ItemCategory.WEAPON &&
    item.weaponType != null &&
    !TWO_HAND_WEAPON_TYPES.has(item.weaponType)
  );
}

// ¿Es un arma de dos manos? (categoría WEAPON con un weaponType de dos manos).
// Ocupa las dos manos: bloquea la off-hand (ver la ocupación en el editor de
// builds, análoga a la de los tocados multi-posición).
export function isTwoHandWeapon(item: {
  category: ItemCategory;
  weaponType: WeaponType | null;
}): boolean {
  return (
    item.category === ItemCategory.WEAPON &&
    item.weaponType != null &&
    TWO_HAND_WEAPON_TYPES.has(item.weaponType)
  );
}

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
