import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { cache } from "react";
import * as tables from "./schema";
import * as relations from "./relations";

// El schema del cliente incluye tablas + relaciones, para habilitar el query API
// relacional (`db.query.<tabla>.findFirst({ with: { … } })`), que sustituye a los
// `include` de Prisma.
const schema = { ...tables, ...relations };

// En Cloudflare Workers (prod) no hay sockets TCP: se conecta con el driver
// serverless de Neon vía Pool (WebSocket), que además soporta transacciones
// interactivas (compras, trades, rate limit). En local (Postgres de docker, host
// que no es de Neon) se usa node-postgres sobre TCP. Mismo criterio que el antiguo
// prisma.ts (Neon vs cliente estándar según el host de DATABASE_URL).
function isNeon(url: string | undefined): boolean {
  return !!url && url.includes("neon.tech");
}

function createNeonDb() {
  const pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  return drizzleNeon(pool, { schema });
}

type Db = ReturnType<typeof createNeonDb>;

function createDb(): Db {
  if (isNeon(process.env.DATABASE_URL)) return createNeonDb();
  // Local (docker Postgres, TCP): node-postgres. `pg` y drizzle-orm/node-postgres
  // se cargan con require dinámico para que NO entren en el bundle del Worker
  // (prod nunca toma esta rama; `pg` va como serverExternalPackage). Se castea al
  // tipo del cliente Neon: la API (core + relacional) es idéntica entre drivers.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/node-postgres");
  return drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema }) as unknown as Db;
}

const globalForDb = globalThis as unknown as { db: Db | undefined };

// En prod (Worker) el cliente se crea POR PETICIÓN y de forma PEREZOSA (primer
// acceso, ya dentro de la petición): en Workers los secretos solo existen en el
// contexto de la petición y la I/O no se reutiliza entre peticiones. En dev
// (Node, proceso largo) se reutiliza un singleton. Mismo patrón que el antiguo
// prisma.ts (Proxy que difiere la creación al primer acceso).
const getDb: () => Db =
  process.env.NODE_ENV === "production" ? cache(createDb) : () => (globalForDb.db ??= createDb());

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const client = getDb();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
