// Importa el catálogo de items (JSON del generador) a la BD, idempotente:
// upsert por `id` (el id estable de RO), así se puede re-ejecutar para añadir
// items nuevos y actualizar los existentes con los datos del catálogo.
//
// Regla de importación: un item entra si tiene id, name, category (enum
// válido) e iconUrl. NO se salta por el campo `error` del catálogo
// (name-conflict / fetch-error): esos son válidos si tienen los datos. Solo
// se salta lo que esté genuinamente incompleto. Si slot/weaponType vinieran
// con un valor fuera del enum, se ponen a null en vez de descartar el item.
//
// `verified` se marca false cuando el generador no dejó el item como
// "verified" (nombre duplicado o fallo de red) — se importa igual, es solo
// una marca de calidad para repasar luego.
//
// Uso: node prisma/importCatalog.mjs [ruta-al-catalog.json]
//   (por defecto ../ro-guild-market-generator/data/catalog.json)

import { PrismaClient, ItemCategory, EquipSlot, WeaponType } from "@prisma/client";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const prisma = new PrismaClient();

const CATEGORIES = new Set(Object.values(ItemCategory));
const SLOTS = new Set(Object.values(EquipSlot));
const WEAPON_TYPES = new Set(Object.values(WeaponType));

const CATALOG_PATH = process.argv[2] ?? "../ro-guild-market-generator/data/catalog.json";
const CHUNK = 50;

// Devuelve el registro listo para la BD, o null si el item no es importable.
function toRecord(raw) {
  if (!raw?.id || !raw?.name || !raw?.iconUrl) return null;
  if (!raw.category || !CATEGORIES.has(raw.category)) return null;
  return {
    id: String(raw.id),
    name: raw.name,
    description: raw.description ?? null,
    category: raw.category,
    slot: raw.slot && SLOTS.has(raw.slot) ? raw.slot : null,
    weaponType: raw.weaponType && WEAPON_TYPES.has(raw.weaponType) ? raw.weaponType : null,
    iconUrl: raw.iconUrl,
    sourceUrl: raw.sources?.sourceOrigin ?? raw.sources?.divinePride ?? raw.sources?.runeNifelheim ?? null,
    verified: raw.verification === "verified",
  };
}

async function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  if (!Array.isArray(catalog)) throw new Error("El catálogo debe ser un array de items");
  console.log(`Catálogo: ${catalog.length} items (${CATALOG_PATH})`);

  const existing = new Set((await prisma.item.findMany({ select: { id: true } })).map((i) => i.id));

  const valid = [];
  let skipped = 0;
  let created = 0;
  let updated = 0;
  for (const raw of catalog) {
    const record = toRecord(raw);
    if (!record) {
      skipped++;
      continue;
    }
    if (existing.has(record.id)) updated++;
    else created++;
    valid.push(record);
  }

  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map((r) =>
        prisma.item.upsert({
          where: { id: r.id },
          create: r,
          update: {
            name: r.name,
            description: r.description,
            category: r.category,
            slot: r.slot,
            weaponType: r.weaponType,
            iconUrl: r.iconUrl,
            sourceUrl: r.sourceUrl,
            verified: r.verified,
          },
        }),
      ),
    );
    process.stdout.write(`\r  procesados ${Math.min(i + CHUNK, valid.length)}/${valid.length}`);
  }

  // Bundle de búsqueda: subconjunto de campos que necesita el autocompletado y
  // el reconocimiento, empaquetado con la app y cargado en memoria (ver
  // src/lib/item-catalog.ts) para no pegar a la BD en cada tecla. Se genera de
  // los mismos `valid` que van a la BD, así van sincronizados.
  const searchCatalog = valid.map(({ id, name, iconUrl, category, slot, weaponType }) => ({
    id,
    name,
    iconUrl,
    category,
    slot,
    weaponType,
  }));
  mkdirSync("src/data", { recursive: true });
  writeFileSync("src/data/catalog-search.json", JSON.stringify(searchCatalog));

  const unverified = valid.filter((r) => !r.verified).length;
  console.log(
    `\nHecho — creados: ${created}, actualizados: ${updated}, saltados (incompletos): ${skipped}, sin verificar: ${unverified}`,
  );
  console.log(`Bundle de búsqueda: src/data/catalog-search.json (${searchCatalog.length} items)`);
}

main()
  .catch((err) => {
    console.error("Error importando el catálogo:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
