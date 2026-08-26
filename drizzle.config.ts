import { defineConfig } from "drizzle-kit";

// En local, si DATABASE_URL no viene ya del entorno, se carga de `.env` (dev/prod
// lo inyectan con dotenvx: npx dotenvx run -f .env.dev -- npm run db:migrate).
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Sin .env: se asume DATABASE_URL en el entorno.
  }
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
