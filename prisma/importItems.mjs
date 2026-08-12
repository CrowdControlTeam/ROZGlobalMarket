// Import/sustitución del catálogo de items desde la DB extraída del cliente del
// juego (ROZDataBaseExtractor). Es la fuente de verdad: lo que no esté aquí se
// borra. Reemplaza por completo la tabla Item. Idempotente.
//
// Uso:
//   node prisma/importItems.mjs [ruta/items.json]
//   (por entorno: npx dotenvx run -f .env.dev -- node prisma/importItems.mjs)
//
// NOTA iconos: por ahora se usa la convención /icons/items/<id>.gif; cuando se
// carguen los sets nuevos (juego + descripciones) se actualiza aquí.

import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SRC = process.argv[2] ?? "E:/Proyectos/Git/ROZDataBaseExtractor/server/output/items.json";

// --- Mapeos (validados contra los 3.682 items, 0 huecos) ---
const CATEGORY_MAP = {
  Weapon: "WEAPON", Armor: "ARMOR", Card: "CARD", Enchant: "ENCHANT", Costume: "COSTUME",
  Healing: "HEALING", Usable: "USABLE", DelayConsume: "DELAY_CONSUME", Etc: "ETC", Ammo: "AMMO",
  PetEgg: "PET_EGG", PetArmor: "PET_ARMOR", Cash: "CASH", GetPoring: "GET_PORING",
};
const WEAPON_SUBTYPE_MAP = {
  "1hSword": "ONE_HAND_SWORD", "2hSword": "TWO_HAND_SWORD", Dagger: "DAGGER",
  "1hAxe": "ONE_HAND_AXE", "2hAxe": "TWO_HAND_AXE", "1hSpear": "ONE_HAND_SPEAR", "2hSpear": "TWO_HAND_SPEAR",
  Staff: "ROD", "2hStaff": "TWO_HAND_ROD", Mace: "MACE", Book: "BOOK", Bow: "BOW",
  Knuckle: "KNUCKLE", Musical: "INSTRUMENT", Whip: "WHIP", Katar: "KATAR",
};
const ARMOR_TYPE_SLOT = {
  Headgear: "HEADGEAR", Helmet: "HEADGEAR", Armor: "ARMOR", Shield: "SHIELD",
  Garment: "GARMENT", Shoes: "FOOTGEAR", Accessory: "ACCESSORY",
  "Accessory (Right)": "ACCESSORY", "Accessory (Left)": "ACCESSORY",
};

const slotOf = (i) =>
  i.category === "Weapon" ? "WEAPON" : i.category === "Armor" ? (ARMOR_TYPE_SLOT[i.type] ?? null) : null;
const weaponTypeOf = (i) => (i.category === "Weapon" ? (WEAPON_SUBTYPE_MAP[i.subType] ?? null) : null);
const tradeableOf = (i) => !(i.move && i.move.trade === false);

function toRow(i) {
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
    iconUrl: `/icons/items/${i.id}.gif`,
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

async function main() {
  const items = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const rows = items.map(toRow);

  // Reemplazo total: la nueva DB es la verdad, lo que no esté desaparece. Los
  // listings/BiS que apunten a un id inexistente se borran (dev/testing). Como
  // Listing.itemId es requerido con onDelete por defecto, se limpia antes.
  const validIds = new Set(rows.map((r) => r.id));
  await prisma.$transaction(async (tx) => {
    const orphanListings = await tx.listing.findMany({
      where: { itemId: { notIn: [...validIds] } },
      select: { id: true },
    });
    if (orphanListings.length) {
      await tx.listing.deleteMany({ where: { id: { in: orphanListings.map((l) => l.id) } } });
    }
    await tx.bisEntry.deleteMany({ where: { itemId: { notIn: [...validIds] } } });
    await tx.item.deleteMany({});
  });

  // Inserta por lotes (createMany no admite relaciones, solo escalares/JSON/arrays).
  const CHUNK = 500;
  for (let n = 0; n < rows.length; n += CHUNK) {
    await prisma.item.createMany({ data: rows.slice(n, n + CHUNK) });
  }

  const total = await prisma.item.count();
  const tradeable = await prisma.item.count({ where: { tradeable: true } });
  console.log(`Items importados: ${total} | comerciables: ${tradeable}`);

  // Bundle de búsqueda empaquetado con la app (solo COMERCIABLES): lo usan el
  // autocompletado de publicar y el match del reconocimiento por imagen (por
  // nombre + slotCount). Ver src/lib/item-catalog.ts.
  const bundle = rows
    .filter((r) => r.tradeable)
    .map((r) => ({
      id: r.id,
      // El nombre lleva el sufijo de ranuras ("Coat[1]") para distinguir en el
      // buscador las variantes con/sin slots del mismo item.
      name: r.slotCount > 0 ? `${r.name}[${r.slotCount}]` : r.name,
      iconUrl: r.iconUrl,
      category: r.category,
      slot: r.slot,
      weaponType: r.weaponType,
      slotCount: r.slotCount,
    }));
  fs.writeFileSync("src/data/catalog-search.json", JSON.stringify(bundle));
  console.log(`Bundle comerciable: ${bundle.length} items → src/data/catalog-search.json`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
