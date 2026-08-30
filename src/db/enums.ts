// Enum values and types, with NO Drizzle dependency (client-safe): imported both
// by the server schema (to define the pgEnums) and by client components, which
// must not pull drizzle-orm/pg-core into the browser bundle. These replace the
// enums that `@prisma/client` used to generate.
//
// The app uses these enums as a VALUE (e.g. `EquipSlot.WEAPON`) as well as a
// type, so each is declared both as a const (object { KEY: "KEY" }) and as a type
// (union), just like Prisma did.

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
// Slots de una build (paperdoll): 3 tocados (superior/medio/inferior) + resto de
// equipo, con 2 accesorios (izquierda/derecha). Son 10, más granular que
// EquipSlot (que agrupa HEADGEAR y ACCESSORY) porque una build los distingue.
export const BUILD_SLOT_VALUES = [
  "HEADGEAR_TOP", "HEADGEAR_MID", "HEADGEAR_LOW", "ARMOR", "WEAPON", "SHIELD",
  "GARMENT", "FOOTGEAR", "ACCESSORY_LEFT", "ACCESSORY_RIGHT",
] as const;
// Etiquetas de una build: al menos una (PvP/PvE), sin genéricos.
export const BUILD_TAG_VALUES = ["PVP", "PVE"] as const;

// Rebuilds the { KEY: "KEY" } object Prisma generated, so the enum can be used as
// a value (EquipSlot.WEAPON).
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
export const BuildSlot = enumObject(BUILD_SLOT_VALUES);
export type BuildSlot = (typeof BUILD_SLOT_VALUES)[number];
export const BuildTag = enumObject(BUILD_TAG_VALUES);
export type BuildTag = (typeof BUILD_TAG_VALUES)[number];
