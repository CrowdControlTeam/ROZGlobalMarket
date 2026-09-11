// Imports/replaces the item catalog from the DB extracted from the game client
// (ROZDataBaseExtractor). It is the source of truth: anything not present here is
// deleted. Fully replaces the Item table. Idempotent.
//
// IMPORTANT: the source is the SUBSET of items TRANSLATED to English
// (`server/output/items.json`), not the full extractor dump
// (`server/output/all_items.json` / `raw_items.json`, ~12k items, many
// untranslated). If the subset's location changes, pass it as an explicit
// argument.
//
// Usage:
//   npm run import:items -- [path/items.json]
//   (per environment: npx dotenvx run -f .env.dev -- npm run import:items)
//
// Icons: convention /icons/items/<id>.png (small) and /icons/details/<id>.png
// (game-style card); copied to public/ from the extractor separately.

import fs from "node:fs";
import { and, eq, isNotNull, notInArray } from "drizzle-orm";
import { buildEntry, buildEntryCard, deal, listing, type EquipSlot, type ItemCategory, type WeaponType } from "../schema";
import { db, runSeed } from "./client";

const SRC = process.argv[2] ?? "E:/Proyectos/Git/ROZDataBaseExtractor/server/output/items.json";

// --- Mappings (validated against the 3,925 items of the translated catalog) ---
const CATEGORY_MAP: Record<string, ItemCategory> = {
  Weapon: "WEAPON", Armor: "ARMOR", Card: "CARD", Enchant: "ENCHANT", Costume: "COSTUME",
  Healing: "HEALING", Usable: "USABLE", DelayConsume: "DELAY_CONSUME", Etc: "ETC", Ammo: "AMMO",
  PetEgg: "PET_EGG", PetArmor: "PET_ARMOR", Cash: "CASH", GetPoring: "GET_PORING",
};
const WEAPON_SUBTYPE_MAP: Record<string, WeaponType> = {
  "1hSword": "ONE_HAND_SWORD", "2hSword": "TWO_HAND_SWORD", Dagger: "DAGGER",
  "1hAxe": "ONE_HAND_AXE", "2hAxe": "TWO_HAND_AXE", "1hSpear": "ONE_HAND_SPEAR", "2hSpear": "TWO_HAND_SPEAR",
  Staff: "ROD", "2hStaff": "TWO_HAND_ROD", Mace: "MACE", Book: "BOOK", Bow: "BOW",
  Knuckle: "KNUCKLE", Musical: "INSTRUMENT", Whip: "WHIP", Katar: "KATAR",
};
const ARMOR_TYPE_SLOT: Record<string, EquipSlot> = {
  Headgear: "HEADGEAR", Helmet: "HEADGEAR", Helm: "HEADGEAR", Armor: "ARMOR", Shield: "SHIELD",
  Garment: "GARMENT", Shoes: "FOOTGEAR", Accessory: "ACCESSORY",
  "Accessory (Right)": "ACCESSORY", "Accessory (Left)": "ACCESSORY",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawItem = any;

const slotOf = (i: RawItem): EquipSlot | null =>
  i.category === "Weapon" ? "WEAPON" : i.category === "Armor" ? (ARMOR_TYPE_SLOT[i.type] ?? null) : null;
const weaponTypeOf = (i: RawItem): WeaponType | null =>
  i.category === "Weapon" ? (WEAPON_SUBTYPE_MAP[i.subType] ?? null) : null;
const tradeableOf = (i: RawItem): boolean => !(i.move && i.move.trade === false);

// La forma del registro completo de item que va al bundle en memoria (item-store
// FullItem). La tabla Item ya no existe en la BD: los items viven solo aquí.
type CatalogRow = {
  id: string;
  name: string;
  unidentifiedName: string | null;
  description: string[];
  category: ItemCategory;
  categorySource: string | null;
  slot: EquipSlot | null;
  weaponType: WeaponType | null;
  subType: string | null;
  itemType: string | null;
  slotCount: number;
  cardSlot: string | null;
  position: string | null;
  iconUrl: string;
  tradeable: boolean;
  restrictions: Record<string, boolean> | null;
  costume: boolean;
  attack: number | null;
  defense: number | null;
  weight: number | null;
  weaponLevel: number | null;
  armorLevel: number | null;
  requiredLevel: number | null;
  jobs: string | null;
  element: string | null;
  classNum: number | null;
  effectId: number | null;
  cooldown: string | null;
  petTarget: string | null;
};

function toRow(i: RawItem): CatalogRow {
  const category = CATEGORY_MAP[i.category];
  if (!category) throw new Error(`Categoría sin mapear: ${i.category} (id ${i.id})`);
  return {
    id: String(i.id),
    name: i.identifiedName,
    unidentifiedName: i.unidentifiedName ?? null,
    description: Array.isArray(i.description) ? i.description : [],
    category,
    categorySource: i.categorySource ?? null,
    slot: slotOf(i),
    weaponType: weaponTypeOf(i),
    subType: i.subType ?? null,
    itemType: i.type ?? null,
    slotCount: Number.isInteger(i.slotCount) ? i.slotCount : 0,
    cardSlot: i.cardSlot ?? null,
    position: i.position ?? null,
    iconUrl: `/icons/items/${i.id}.png`,
    tradeable: tradeableOf(i),
    restrictions: i.move ?? null,
    costume: i.costume === true,
    attack: i.attack ?? null,
    defense: i.defense ?? null,
    weight: i.weight ?? null,
    weaponLevel: i.weaponLevel ?? null,
    armorLevel: i.armorLevel ?? null,
    requiredLevel: i.requiredLevel ?? null,
    jobs: i.jobs ?? null,
    element: i.element ?? null,
    classNum: i.classNum ?? null,
    effectId: i.effectId ?? null,
    cooldown: i.cooldown != null ? String(i.cooldown) : null,
    petTarget: i.petTarget ?? null,
  };
}

runSeed(async () => {
  const items: RawItem[] = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const rows = items.map(toRow);
  const validIds = [...new Set(rows.map((r) => r.id))];

  // La tabla Item ya no existe: los items viven solo en el bundle en memoria. Este
  // script (a) regenera el bundle y (b) mantiene la integridad referencial que
  // antes garantizaban las FKs, que ahora se gestiona en la app.

  const tradeableCount = rows.filter((r) => r.tradeable).length;
  console.log(`Items en el catálogo: ${rows.length} | comerciables: ${tradeableCount}`);

  // Solo regenerar el bundle (sin tocar la BD): útil para actualizar
  // item-catalog.json sin una BD levantada (p. ej. tras una re-extracción).
  // Uso: BUNDLE_ONLY=1 npm run import:items
  if (process.env.BUNDLE_ONLY) {
    fs.writeFileSync("src/data/item-catalog.json", JSON.stringify(rows));
    console.log(`Catálogo completo (bundle only): ${rows.length} items → src/data/item-catalog.json`);
    return;
  }

  // 1) Limpieza de referencias a items que ya no están en el catálogo (antes lo
  //    hacían las FKs: required/restrict borra, Deal.offeredItemId opcional → null).
  const [delListings, delCards, delEntries] = await Promise.all([
    db.delete(listing).where(notInArray(listing.itemId, validIds)),
    db.delete(buildEntryCard).where(notInArray(buildEntryCard.cardItemId, validIds)),
    db.delete(buildEntry).where(notInArray(buildEntry.itemId, validIds)),
  ]);
  await db
    .update(deal)
    .set({ offeredItemId: null })
    .where(and(isNotNull(deal.offeredItemId), notInArray(deal.offeredItemId, validIds)));
  const removedRefs = (delListings.rowCount ?? 0) + (delCards.rowCount ?? 0) + (delEntries.rowCount ?? 0);
  if (removedRefs > 0) console.log(`Referencias colgantes limpiadas: ${removedRefs}`);

  // 2) Re-sincroniza los campos de item desnormalizados en los listings (nombre/
  //    categoría/slots que el grid del mercado usa para filtrar/ordenar/paginar en
  //    SQL) desde el catálogo nuevo — solo los items que tienen publicaciones.
  const rowsById = new Map(rows.map((r) => [r.id, r]));
  const listed = await db.selectDistinct({ itemId: listing.itemId }).from(listing);
  for (const { itemId } of listed) {
    const r = rowsById.get(itemId);
    if (!r) continue; // ya limpiado arriba
    await db
      .update(listing)
      .set({
        itemName: r.name,
        itemCategory: r.category,
        itemSlot: r.slot,
        itemWeaponType: r.weaponType,
        itemSlotCount: r.slotCount,
      })
      .where(eq(listing.itemId, itemId));
  }

  // 3) Bundle completo empaquetado con la app: el registro completo de cada item,
  //    cargado en memoria (item-store) — los items son datos estáticos de
  //    referencia, se importan aquí y nunca se mutan en runtime.
  fs.writeFileSync("src/data/item-catalog.json", JSON.stringify(rows));
  console.log(`Catálogo completo: ${rows.length} items → src/data/item-catalog.json`);
});
