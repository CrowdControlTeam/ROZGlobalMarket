// Datos base de BiS: etapa inicial (EC), roles de combate y 1st jobs.
// Idempotente (upsert por `key`), re-ejecutable sin duplicar. Manual por entorno,
// como las migraciones:
//   npm run seed:bis                                       (local, .env)
//   npx dotenvx run -f .env.dev -- npm run seed:bis        (dev)
//   npx dotenvx run -f .env.production -- npm run seed:bis (prod)

import { bisStage, combatRole, job, type JobTier } from "../schema";
import { db, runSeed } from "./client";

const STAGES = [{ key: "EC", label: "Early Content", order: 1 }];

const ROLES = [
  { key: "TANK", label: "Tank", order: 1 },
  { key: "DPS", label: "DPS", order: 2 },
  { key: "SUPPORT", label: "Support", order: 3 },
  { key: "HEALER", label: "Healer", order: 4 },
];

// EC solo tiene 1st jobs. Los 2nd (y siguientes) se añaden aquí cuando salgan,
// con tier "SECOND" y su parentJob correspondiente.
const JOBS: { key: string; label: string; tier: JobTier; order: number }[] = [
  { key: "SWORDMAN", label: "Swordman", tier: "FIRST", order: 1 },
  { key: "MAGE", label: "Mage", tier: "FIRST", order: 2 },
  { key: "ARCHER", label: "Archer", tier: "FIRST", order: 3 },
  { key: "ACOLYTE", label: "Acolyte", tier: "FIRST", order: 4 },
  { key: "MERCHANT", label: "Merchant", tier: "FIRST", order: 5 },
  { key: "THIEF", label: "Thief", tier: "FIRST", order: 6 },
];

runSeed(async () => {
  for (const s of STAGES) {
    await db
      .insert(bisStage)
      .values(s)
      .onConflictDoUpdate({ target: bisStage.key, set: { label: s.label, order: s.order } });
  }
  for (const r of ROLES) {
    await db
      .insert(combatRole)
      .values(r)
      .onConflictDoUpdate({ target: combatRole.key, set: { label: r.label, order: r.order } });
  }
  for (const j of JOBS) {
    await db
      .insert(job)
      .values(j)
      .onConflictDoUpdate({ target: job.key, set: { label: j.label, tier: j.tier, order: j.order } });
  }
  console.log(`Seed BiS: ${STAGES.length} etapa(s), ${ROLES.length} rol(es), ${JOBS.length} job(s).`);
});
