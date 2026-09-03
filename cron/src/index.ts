import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { listing } from "../../src/db/schema";

// En Workers, las queries sueltas del Pool de Neon deben ir por HTTP fetch en
// vez de abrir un WebSocket (mismo motivo que src/db/index.ts en la app): sin
// esto, el UPDATE de expiración fallaría al montar el socket.
neonConfig.poolQueryViaFetch = true;

// Tipos mínimos de Workers inline (evitamos añadir @cloudflare/workers-types
// solo por dos firmas en un worker de ~30 líneas).
interface Env {
  DATABASE_URL: string;
}
interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}

// Worker de cron: al dispararse el trigger, marca EXPIRED las publicaciones
// ACTIVE cuya expiresAt ya venció. Reutiliza el schema de la app (import
// relativo a ../../src/db/schema), así no duplica el modelo.
export default {
  async scheduled(_event: unknown, env: Env, ctx: Ctx): Promise<void> {
    ctx.waitUntil(expireListings(env.DATABASE_URL));
  },
};

async function expireListings(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString });
  try {
    const db = drizzle(pool);
    // expiresAt NULL nunca cumple `<= now()` (comparación desconocida), así que
    // las filas sin caducidad quedan intactas — null = no caduca (por diseño).
    // Además, las publicaciones ILIMITADAS (quantity NULL) NUNCA caducan aunque
    // tuvieran un expiresAt heredado (red de seguridad; ver migración 0004).
    const result = await db
      .update(listing)
      .set({ status: "EXPIRED" })
      .where(
        and(
          eq(listing.status, "ACTIVE"),
          isNotNull(listing.quantity),
          lte(listing.expiresAt, sql`now()`),
        ),
      );
    console.log(`[cron] listings expired: ${result.rowCount ?? 0}`);
  } finally {
    await pool.end();
  }
}
