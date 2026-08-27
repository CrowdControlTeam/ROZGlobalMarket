// Base BiS data: initial stage (EC), combat roles and 1st jobs. Idempotent
// (upsert by `key`), re-runnable without duplicating. Applied manually per
// environment, like migrations:
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

// EC only has 1st jobs. The 2nd (and later) ones are added here when they
// release, with tier "SECOND" and their corresponding parentJob.
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
  console.log(`Seed BiS: ${STAGES.length} stage(s), ${ROLES.length} role(s), ${JOBS.length} job(s).`);
});
