import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "../schema";
import * as relations from "../relations";

// Cliente Drizzle para los scripts de seed/import (Node, no el Worker): usa
// node-postgres sobre TCP, que sirve tanto para el Postgres de docker (local)
// como para Neon (dev/prod, endpoint directo). Se ejecutan con `tsx`.
//
// Env: en dev/prod las variables las inyecta dotenvx antes de correr el script
// (npx dotenvx run -f .env.dev -- npm run …); en local, si DATABASE_URL no está
// en el entorno, se carga de `.env` (equivale a que Prisma lo cargaba solo).
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Sin .env: se asume DATABASE_URL ya en el entorno (dotenvx). Si falta, el
    // Pool fallará al conectar con un mensaje claro.
  }
}

const schema = { ...tables, ...relations };

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Ejecuta el cuerpo del seed y cierra el pool siempre (para que el proceso
// termine). Mismo patrón que el .catch/.finally de los scripts con Prisma.
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
