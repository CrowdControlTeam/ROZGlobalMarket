import { defineConfig } from "drizzle-kit";

// Locally, if no connection string is in the environment, load it from `.env`
// (dev/prod inject it via dotenvx: npx dotenvx run -f .env.dev -- npm run db:migrate).
if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env: assume the connection string is in the environment.
  }
}

// Migrations run as the privileged migrator role (DDL: create schema, alter
// tables), not the least-privilege app role. In dev/prod that role + the direct
// (non-pooler) endpoint live in DIRECT_URL; the app uses DATABASE_URL (pooled,
// app role). Locally there's only DATABASE_URL (docker superuser), so fall back.
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: migrationUrl },
});
