import { defineConfig } from "drizzle-kit";

// Locally, if DATABASE_URL isn't already in the environment, load it from `.env`
// (dev/prod inject it via dotenvx: npx dotenvx run -f .env.dev -- npm run db:migrate).
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env: assume DATABASE_URL is in the environment.
  }
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
