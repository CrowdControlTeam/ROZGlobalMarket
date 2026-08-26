// Valores y tipos de los enums, SIN dependencias de Drizzle (client-safe): los
// importan tanto el schema del servidor (para definir los pgEnum) como los
// componentes cliente, que no deben arrastrar drizzle-orm/pg-core al bundle del
// navegador. Reemplazan a los enums que generaba `@prisma/client`.
//
// La app usa estos enums como VALOR (p. ej. `EquipSlot.WEAPON`) además de como
// tipo, así que cada uno se declara a la vez como const (objeto { CLAVE: "CLAVE" })
// y como type (unión), igual que hacía Prisma.

export const ITEM_CATEGORY_VALUES = [
  "WEAPON", "ARMOR", "CARD", "ENCHANT", "COSTUME", "HEALING", "USABLE",
  "DELAY_CONSUME", "AMMO", "ETC", "PET_EGG", "PET_ARMOR", "CASH", "GET_PORING",
] as const;
export const EQUIP_SLOT_VALUES = [
  "HEADGEAR", "ARMOR", "SHIELD", "GARMENT", "FOOTGEAR", "ACCESSORY", "WEAPON",
] as const;
export const WEAPON_TYPE_VALUES = [
  "DAGGER", "ONE_HAND_SWORD", "TWO_HAND_SWORD", "ONE_HAND_SPEAR", "TWO_HAND_SPEAR",
  "ONE_HAND_AXE", "TWO_HAND_AXE", "MACE", "ROD", "TWO_HAND_ROD", "BOW", "KNUCKLE",
  "INSTRUMENT", "WHIP", "BOOK", "KATAR", "REVOLVER", "RIFLE", "GATLING_GUN",
  "SHOTGUN", "GRENADE_LAUNCHER", "FUUMA_SHURIKEN",
] as const;
export const LISTING_TYPE_VALUES = ["SALE", "TRADE", "BUY", "GIFT"] as const;
export const LISTING_STATUS_VALUES = ["ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"] as const;
export const DEAL_STATUS_VALUES = ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"] as const;
export const ITEM_OPTION_GROUP_VALUES = [
  "ARMOR", "GARMENT", "FOOTGEAR", "WEAPON_PHYSICAL", "WEAPON_MAGICAL",
] as const;
export const JOB_TIER_VALUES = ["FIRST", "SECOND", "THIRD"] as const;

// Reconstruye el objeto { CLAVE: "CLAVE" } que generaba Prisma para poder usar
// el enum como valor (EquipSlot.WEAPON).
function enumObject<const T extends readonly string[]>(values: T): { [K in T[number]]: K } {
  return Object.fromEntries(values.map((v) => [v, v])) as { [K in T[number]]: K };
}

export const ItemCategory = enumObject(ITEM_CATEGORY_VALUES);
export type ItemCategory = (typeof ITEM_CATEGORY_VALUES)[number];
export const EquipSlot = enumObject(EQUIP_SLOT_VALUES);
export type EquipSlot = (typeof EQUIP_SLOT_VALUES)[number];
export const WeaponType = enumObject(WEAPON_TYPE_VALUES);
export type WeaponType = (typeof WEAPON_TYPE_VALUES)[number];
export const ListingType = enumObject(LISTING_TYPE_VALUES);
export type ListingType = (typeof LISTING_TYPE_VALUES)[number];
export const ListingStatus = enumObject(LISTING_STATUS_VALUES);
export type ListingStatus = (typeof LISTING_STATUS_VALUES)[number];
export const DealStatus = enumObject(DEAL_STATUS_VALUES);
export type DealStatus = (typeof DEAL_STATUS_VALUES)[number];
export const ItemOptionGroup = enumObject(ITEM_OPTION_GROUP_VALUES);
export type ItemOptionGroup = (typeof ITEM_OPTION_GROUP_VALUES)[number];
export const JobTier = enumObject(JOB_TIER_VALUES);
export type JobTier = (typeof JOB_TIER_VALUES)[number];
