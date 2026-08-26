// Migration baseline for a DB that ALREADY has the schema (previously created by
// Prisma's migrations). Marks the current drizzle migrations as ALREADY applied
// —without running them— so `db:migrate` won't try to recreate the tables. Run
// ONCE per environment, during the transition:
//   npm run db:baseline                                       (local, .env)
//   npx dotenvx run -f .env.dev -- npm run db:baseline        (dev)
//   npx dotenvx run -f .env.production -- npm run db:baseline (prod)
//
// Idempotent (won't re-insert what's already recorded). From here on, schema
// changes are applied with `db:generate` + `db:migrate` as usual: this script is
// NOT used again (it would mark a future migration as applied without running it).

import { readMigrationFiles } from "drizzle-orm/migrator";
import { pool, runSeed } from "./client";

runSeed(async () => {
  // Same hash computation as drizzle-kit (sha256 of each .sql file's content).
  const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });

  await pool.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
  await pool.query(
    'CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)',
  );

  let marked = 0;
  for (const m of migrations) {
    const { rowCount } = await pool.query(
      'SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = $1',
      [m.hash],
    );
    if (!rowCount) {
      await pool.query(
        'INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)',
        [m.hash, m.folderMillis],
      );
      marked++;
      console.log(`Baseline: marcada ${m.hash.slice(0, 12)}… como aplicada.`);
    } else {
      console.log(`Baseline: ${m.hash.slice(0, 12)}… ya estaba registrada.`);
    }
  }
  console.log(
    `Baseline completo (${marked} nueva(s) marcada(s)). Los próximos cambios se aplican con db:generate + db:migrate.`,
  );
});
