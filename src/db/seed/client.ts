import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "../schema";
import * as relations from "../relations";

// Drizzle client for the seed/import scripts (Node, not the Worker): uses
// node-postgres over TCP, which works both for the docker Postgres (local) and
// for Neon (dev/prod, direct endpoint). Run with `tsx`.
//
// Env: on dev/prod the variables are injected by dotenvx before running the
// script (npx dotenvx run -f .env.dev -- npm run …); locally, if no connection
// string is in the environment, it's loaded from `.env`.
if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env: assume the connection string is already in the environment
    // (dotenvx). If it is missing, the Pool will fail with a clear message.
  }
}

const schema = { ...tables, ...relations };

// Seed/import/baseline are ops tooling (bulk writes, and baseline creates the
// migrations schema): they run as the privileged migrator role via DIRECT_URL,
// not the least-privilege app role (DATABASE_URL). Locally there's only
// DATABASE_URL (docker superuser), so fall back to it.
export const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
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
