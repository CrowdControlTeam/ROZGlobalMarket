import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "../schema";
import * as relations from "../relations";

// Drizzle client for the seed/import scripts (Node, not the Worker): uses
// node-postgres over TCP, which works both for the docker Postgres (local) and
// for Neon (dev/prod, direct endpoint). Run with `tsx`.
//
// Env: on dev/prod the variables are injected by dotenvx before running the
// script (npx dotenvx run -f .env.dev -- npm run …); locally, if DATABASE_URL is
// not in the environment, it's loaded from `.env` (as Prisma used to load it).
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env: assume DATABASE_URL is already in the environment (dotenvx). If it
    // is missing, the Pool will fail to connect with a clear message.
  }
}

const schema = { ...tables, ...relations };

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Runs the seed body and always closes the pool (so the process exits). Same
// pattern as the .catch/.finally of the Prisma scripts.
export async function runSeed(main: () => Promise<void>): Promise<void> {
  try {
    await main();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
