// Imports/replaces the item catalog from the DB extracted from the game client
// (ROZDataBaseExtractor). It is the source of truth: anything not present here is
// deleted. Fully replaces the Item table. Idempotent.
//
// IMPORTANT: the source is the SUBSET of items TRANSLATED to English
// (`server/output/icons/items.json`), not the full extractor dump
// (`server/output/items.json`), which holds ~12k items, many untranslated. If the
// subset's location changes, pass it as an explicit argument.
//
// Usage:
//   npm run import:items -- [path/items.json]
//   (per environment: npx dotenvx run -f .env.dev -- npm run import:items)
//
// Icons: convention /icons/items/<id>.png (small) and /icons/details/<id>.png
// (game-style card); copied to public/ from the extractor separately.

import fs from "node:fs";
import { count, eq, notInArray } from "drizzle-orm";
import { buildEntry, buildEntryCard, item, listing, type EquipSlot, type ItemCategory, type WeaponType } from "../schema";
import { db, runSeed } from "./client";

const SRC = process.argv[2] ?? "E:/Proyectos/Git/ROZDataBaseExtractor/server/output/icons/items.json";

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

type ItemRow = typeof item.$inferInsert;

function toRow(i: RawItem): ItemRow {
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
    updatedAt: new Date(),
  };
}

runSeed(async () => {
  const items: RawItem[] = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const rows = items.map(toRow);

  // Idempotent, FK-safe replacement (the new DB is the truth; anything missing
  // disappears). Items are NOT wiped and recreated, because the ones that still
  // exist may be referenced by listings/BiS/deals; so UPSERT, then delete only the
  // ones that are gone:
  const validIds = [...new Set(rows.map((r) => r.id as string))];

  // Diff against what was there, to report the impact of the update.
  const existingIds = new Set((await db.select({ id: item.id }).from(item)).map((i) => i.id));
  const newIdSet = new Set(validIds);
  const createdCount = validIds.filter((id) => !existingIds.has(id)).length;
  const matchedCount = validIds.filter((id) => existingIds.has(id)).length;
  const deletedCount = [...existingIds].filter((id) => !newIdSet.has(id)).length;

  // 1) Clean up references to items that disappear (todas con FK required/restrict:
  //    Listing.itemId, BuildEntry.itemId, BuildEntryCard.cardItemId; Deal
  //    .offeredItemId es opcional → SetNull, no hace falta borrarlo aquí).
  await db.delete(listing).where(notInArray(listing.itemId, validIds));
  await db.delete(buildEntryCard).where(notInArray(buildEntryCard.cardItemId, validIds));
  await db.delete(buildEntry).where(notInArray(buildEntry.itemId, validIds));

  // 2) Upsert every item (updates the existing ones, creates the new ones), in
  //    parallel chunks. Drizzle has no bulk upsert with per-row data, so it's done
  //    one row at a time (onConflictDoUpdate by id).
  const CHUNK = 100;
  for (let n = 0; n < rows.length; n += CHUNK) {
    await Promise.all(
      // set: r rewrites every column of the existing item to the file's value
      // (includes id = same value, a no-op) — the source is the truth.
      rows.slice(n, n + CHUNK).map((r) =>
        db.insert(item).values(r).onConflictDoUpdate({ target: item.id, set: r }),
      ),
    );
  }

  // 3) Delete the items that are gone (their references were already cleaned up).
  await db.delete(item).where(notInArray(item.id, validIds));

  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(item);
  const [{ tradeable } = { tradeable: 0 }] = await db
    .select({ tradeable: count() })
    .from(item)
    .where(eq(item.tradeable, true));
  console.log(`Items importados: ${total} | comerciables: ${tradeable}`);
  console.log(
    `Cambios: ${createdCount} nuevos | ${matchedCount} existentes re-sincronizados | ${deletedCount} borrados`,
  );

  // Search bundle shipped with the app (TRADEABLE only): used by the publish
  // autocomplete and the image-recognition match (by name + slotCount). See
  // src/lib/item-catalog.ts.
  const bundle = rows
    .filter((r) => r.tradeable)
    .map((r) => ({
      id: r.id,
      // The name carries the slot suffix ("Coat[1]") to tell apart, in the search,
      // the with/without-slots variants of the same item.
      name: (r.slotCount ?? 0) > 0 ? `${r.name}[${r.slotCount}]` : r.name,
      iconUrl: r.iconUrl,
      category: r.category,
      slot: r.slot,
      weaponType: r.weaponType,
      slotCount: r.slotCount,
    }));
  fs.writeFileSync("src/data/catalog-search.json", JSON.stringify(bundle));
  console.log(`Bundle comerciable: ${bundle.length} items → src/data/catalog-search.json`);
});
