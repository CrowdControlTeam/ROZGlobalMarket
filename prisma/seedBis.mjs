// Datos base de BiS: etapa inicial (EC), roles de combate y 1st jobs.
// Idempotente (upsert por `key`), así que se puede re-ejecutar sin duplicar y
// editar después en BD (Prisma Studio). Manual por entorno, como las
// migraciones:
//   node prisma/seedBis.mjs                              (local, .env)
//   npx dotenvx run -f .env.dev -- node prisma/seedBis.mjs        (dev)
//   npx dotenvx run -f .env.production -- node prisma/seedBis.mjs (prod)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STAGES = [{ key: "EC", label: "Early Content", order: 1 }];

const ROLES = [
  { key: "TANK", label: "Tank", order: 1 },
  { key: "DPS", label: "DPS", order: 2 },
  { key: "SUPPORT", label: "Support", order: 3 },
  { key: "HEALER", label: "Healer", order: 4 },
];

// EC solo tiene 1st jobs. Los 2nd (y siguientes) se añaden aquí cuando salgan,
// con tier "SECOND" y su parentJob correspondiente.
const JOBS = [
  { key: "SWORDMAN", label: "Swordman", tier: "FIRST", order: 1 },
  { key: "MAGE", label: "Mage", tier: "FIRST", order: 2 },
  { key: "ARCHER", label: "Archer", tier: "FIRST", order: 3 },
  { key: "ACOLYTE", label: "Acolyte", tier: "FIRST", order: 4 },
  { key: "MERCHANT", label: "Merchant", tier: "FIRST", order: 5 },
  { key: "THIEF", label: "Thief", tier: "FIRST", order: 6 },
];

async function main() {
  for (const s of STAGES) {
    await prisma.bisStage.upsert({
      where: { key: s.key },
      update: { label: s.label, order: s.order },
      create: s,
    });
  }
  for (const r of ROLES) {
    await prisma.combatRole.upsert({
      where: { key: r.key },
      update: { label: r.label, order: r.order },
      create: r,
    });
  }
  for (const j of JOBS) {
    await prisma.job.upsert({
      where: { key: j.key },
      update: { label: j.label, tier: j.tier, order: j.order },
      create: j,
    });
  }
  console.log(`Seed BiS: ${STAGES.length} etapa(s), ${ROLES.length} rol(es), ${JOBS.length} job(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
