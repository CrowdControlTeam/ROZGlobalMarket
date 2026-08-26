import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { cache } from "react";
import * as tables from "./schema";
import * as relations from "./relations";

// El schema del cliente incluye tablas + relaciones, para habilitar el query API
// relacional (`db.query.<tabla>.findFirst({ with: { … } })`), que sustituye a los
// `include` de Prisma.
const schema = { ...tables, ...relations };

// Cliente Drizzle. En Cloudflare Workers (prod) se usa el driver serverless de
// Neon vía Pool (WebSocket) — soporta transacciones interactivas (compras,
// trades, rate limit), a diferencia del HTTP. Mismo patrón que el antiguo
// prisma.ts: los secretos solo están disponibles dentro de la petición, y en
// Workers no se reutiliza I/O entre peticiones, así que en prod se crea POR
// PETICIÓN (cache() de React memoiza dentro de una); en dev (Node) se reutiliza
// un singleton. En local (Postgres de docker, no Neon) el Pool de Neon no
// habla el protocolo WebSocket de Neon — para dev se resuelve con node-postgres
// más abajo.
function createDb() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return drizzle(pool, { schema });
}

const globalForDb = globalThis as unknown as { db: ReturnType<typeof createDb> | undefined };

// En prod (Worker) el cliente se crea POR PETICIÓN y de forma PEREZOSA (primer
// acceso, ya dentro de la petición): en Workers los secretos solo existen en el
// contexto de la petición y la I/O no se reutiliza entre peticiones. En dev
// (Node, proceso largo) se reutiliza un singleton. Mismo patrón que el antiguo
// prisma.ts (Proxy que difiere la creación al primer acceso).
const getDb: () => ReturnType<typeof createDb> =
  process.env.NODE_ENV === "production"
    ? cache(createDb)
    : () => (globalForDb.db ??= createDb());

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    const client = getDb();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
