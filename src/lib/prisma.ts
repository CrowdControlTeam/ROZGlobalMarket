import { cache } from "react";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Prisma lee las cadenas de conexión de DATABASE_URL (pooled, uso normal de
// la app) y DIRECT_URL (directa, solo la necesita `prisma migrate`) — ver
// `url`/`directUrl` en schema.prisma. Se toman tal cual del entorno:
//   - Local: apuntan al Postgres de docker-compose (ver .env.example).
//   - Producción (Neon): DATABASE_URL usa el endpoint pooled de Neon y
//     DIRECT_URL el directo; ambas se configuran como variables de entorno
//     del despliegue (ver .env.example).
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  // En Cloudflare Workers (producción) no hay sockets TCP, así que se conecta
  // con el driver serverless de Neon vía adaptador. Además, para que en Workers
  // Prisma use el motor WASM (y no el binario nativo, que haría fs.readdir ->
  // 500) el cliente va como serverExternalPackage y OpenNext lo parchea — ver
  // next.config.ts. Se elige PrismaNeon (WebSocket/Pool) y no PrismaNeonHTTP
  // porque la app usa transacciones interactivas (compras, trades, rate limit),
  // que el modo HTTP no soporta. En local (docker Postgres, host que no es de
  // Neon) se usa el cliente estándar sobre el motor nativo, sin adaptador.
  if (connectionString && connectionString.includes("neon.tech")) {
    return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
  }
  return new PrismaClient();
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// El cliente se obtiene de forma PEREZOSA (en el primer acceso, ya dentro de
// una petición) en vez de al cargar el módulo: en Cloudflare Workers los
// secrets (DATABASE_URL) solo están disponibles dentro del contexto de la
// petición, no en el ámbito de módulo.
//
// Además, en Workers no se puede reutilizar una conexión (I/O) entre
// peticiones distintas, así que un cliente global compartido fallaría a partir
// de la 2ª petición. Por eso en producción (Worker) se crea POR PETICIÓN con
// cache() de React (memoiza dentro de la misma petición, uno nuevo en la
// siguiente). En desarrollo (Node, proceso de larga vida) crear un pool por
// petición filtraría conexiones, así que ahí se reutiliza un singleton. La
// rama se resuelve en build (NODE_ENV es constante), no en runtime.
const getClient: () => PrismaClient =
  process.env.NODE_ENV === "production"
    ? cache(createPrismaClient)
    : () => (globalForPrisma.prisma ??= createPrismaClient());

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;
