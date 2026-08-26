// Import/sustitución del catálogo de items desde la DB extraída del cliente del
// juego (ROZDataBaseExtractor). Es la fuente de verdad: lo que no esté aquí se
// borra. Reemplaza por completo la tabla Item. Idempotente.
//
// IMPORTANTE: la fuente es el SUBCONJUNTO de items TRADUCIDOS al inglés
// (`server/output/icons/items.json`), no el volcado completo del extractor
// (`server/output/items.json`), que trae ~12k items, muchos sin traducir. Si
// cambia la ubicación del subconjunto, pásala como argumento explícito.
//
// Uso:
//   npm run import:items -- [ruta/items.json]
//   (por entorno: npx dotenvx run -f .env.dev -- npm run import:items)
//
// Iconos: convención /icons/items/<id>.png (pequeño) y /icons/details/<id>.png
// (ficha estilo juego); se copian a public/ desde el extractor aparte.

import fs from "node:fs";
import { count, eq, notInArray } from "drizzle-orm";
import { bisEntry, item, listing, type EquipSlot, type ItemCategory, type WeaponType } from "../schema";
import { db, runSeed } from "./client";

const SRC = process.argv[2] ?? "E:/Proyectos/Git/ROZDataBaseExtractor/server/output/icons/items.json";

// --- Mapeos (validados contra los 3.925 items del catálogo traducido) ---
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

  // Reemplazo idempotente y FK-safe (la nueva DB es la verdad, lo que no esté
  // desaparece). NO se borran todos los items y se recrean, porque los que
  // siguen existiendo pueden estar referenciados por listings/BiS/deals; se hace
  // UPSERT y luego se borran solo los que ya no están:
  const validIds = [...new Set(rows.map((r) => r.id as string))];

  // Diff contra lo que ya había, para reportar el impacto de la actualización.
  const existingIds = new Set((await db.select({ id: item.id }).from(item)).map((i) => i.id));
  const newIdSet = new Set(validIds);
  const createdCount = validIds.filter((id) => !existingIds.has(id)).length;
  const matchedCount = validIds.filter((id) => existingIds.has(id)).length;
  const deletedCount = [...existingIds].filter((id) => !newIdSet.has(id)).length;

  // 1) Limpiar referencias a items que desaparecen (Listing.itemId es requerido;
  //    BisEntry.itemId opcional; Deal.offeredItemId opcional → SetNull solo).
  await db.delete(listing).where(notInArray(listing.itemId, validIds));
  await db.delete(bisEntry).where(notInArray(bisEntry.itemId, validIds));

  // 2) Upsert de todos los items (actualiza los existentes, crea los nuevos), por
  //    lotes en paralelo. Drizzle no tiene upsert masivo con datos por fila, así
  //    que se hace uno por fila (onConflictDoUpdate por id).
  const CHUNK = 100;
  for (let n = 0; n < rows.length; n += CHUNK) {
    await Promise.all(
      // set: r reescribe todas las columnas del item existente al valor del
      // archivo (incluye id = mismo valor, no-op) — la fuente es la verdad.
      rows.slice(n, n + CHUNK).map((r) =>
        db.insert(item).values(r).onConflictDoUpdate({ target: item.id, set: r }),
      ),
    );
  }

  // 3) Borrar los items que ya no están (sus referencias ya se limpiaron).
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

  // Bundle de búsqueda empaquetado con la app (solo COMERCIABLES): lo usan el
  // autocompletado de publicar y el match del reconocimiento por imagen (por
  // nombre + slotCount). Ver src/lib/item-catalog.ts.
  const bundle = rows
    .filter((r) => r.tradeable)
    .map((r) => ({
      id: r.id,
      // El nombre lleva el sufijo de ranuras ("Coat[1]") para distinguir en el
      // buscador las variantes con/sin slots del mismo item.
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
