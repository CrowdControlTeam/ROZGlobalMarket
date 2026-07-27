// Puebla MagicalWeaponType con los tipos de arma por defecto que cuentan
// como "arma mágica" (pool WEAPON_MAGICAL). Idempotente (createMany +
// skipDuplicates). Editable después directamente en la base de datos
// (Prisma Studio) sin necesidad de re-ejecutar este script.
//
// Uso: node prisma/seedMagicalWeaponType.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_MAGICAL_TYPES = ["ROD", "TWO_HAND_ROD", "BOOK"];

async function main() {
  const result = await prisma.magicalWeaponType.createMany({
    data: DEFAULT_MAGICAL_TYPES.map((type) => ({ type })),
    skipDuplicates: true,
  });
  console.log(`Insertados: ${result.count} (de ${DEFAULT_MAGICAL_TYPES.length} por defecto).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
