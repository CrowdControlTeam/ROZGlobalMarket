// Puebla la fila única de MarketConfig (id=1) si no existe. Idempotente
// (upsert) — no pisa maxRefineLevel si ya se ajustó a mano en Prisma Studio.
//
// Uso: node prisma/seedMarketConfig.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const config = await prisma.marketConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, maxRefineLevel: 10 },
  });
  console.log("MarketConfig:", config);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
