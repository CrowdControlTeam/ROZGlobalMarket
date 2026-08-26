import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { cache } from "react";
import * as tables from "./schema";
import * as relations from "./relations";

// The client schema includes tables + relations, to enable the relational query
// API (`db.query.<table>.findFirst({ with: { … } })`) that replaces Prisma's
// `include`.
const schema = { ...tables, ...relations };

// On Cloudflare Workers (prod) there are no TCP sockets: connect with Neon's
// serverless driver via a Pool (WebSocket), which also supports interactive
// transactions (purchases, trades, rate limit). Locally (docker Postgres, a
// non-Neon host) use node-postgres over TCP. Same criterion as the old prisma.ts
// (Neon vs. standard client based on the DATABASE_URL host).
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
  // Local (docker Postgres, TCP): node-postgres. `pg` and drizzle-orm/node-postgres
  // are loaded with a dynamic require so they do NOT enter the Worker bundle (prod
  // never takes this branch; `pg` is a serverExternalPackage). Cast to the Neon
  // client type: the API (core + relational) is identical across drivers.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/node-postgres");
  return drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema }) as unknown as Db;
}

const globalForDb = globalThis as unknown as { db: Db | undefined };

// In prod (Worker) the client is created PER REQUEST and LAZILY (on first access,
// already inside the request): on Workers secrets only exist within the request
// context and I/O is not reused across requests. In dev (Node, long-lived
// process) a singleton is reused. Same pattern as the old prisma.ts (a Proxy that
// defers creation to first access).
const getDb: () => Db =
  process.env.NODE_ENV === "production" ? cache(createDb) : () => (globalForDb.db ??= createDb());

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const client = getDb();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
