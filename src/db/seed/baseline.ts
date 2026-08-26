// Baseline de migraciones para una DB que YA tiene el schema (creado antes por
// las migraciones de Prisma). Marca las migraciones actuales de drizzle como YA
// aplicadas —sin ejecutarlas— para que `db:migrate` no intente volver a crear
// las tablas. Se corre UNA sola vez por entorno, durante la transición:
//   npm run db:baseline                                       (local, .env)
//   npx dotenvx run -f .env.dev -- npm run db:baseline        (dev)
//   npx dotenvx run -f .env.production -- npm run db:baseline (prod)
//
// Es idempotente (no re-inserta lo ya registrado). A partir de aquí, los cambios
// de schema se aplican con `db:generate` + `db:migrate` con normalidad: NO se
// vuelve a usar este script (marcaría como aplicada una migración futura sin
// ejecutarla).

import { readMigrationFiles } from "drizzle-orm/migrator";
import { pool, runSeed } from "./client";

runSeed(async () => {
  // Mismo cálculo de hash que drizzle-kit (sha256 del contenido de cada .sql).
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
