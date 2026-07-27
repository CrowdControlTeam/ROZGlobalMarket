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
  // En Cloudflare Workers (producción) no hay sockets TCP, así que el cliente
  // estándar de Prisma no puede conectar: se usa el driver serverless de Neon
  // vía adaptador. Se elige PrismaNeon (WebSocket/Pool) y no PrismaNeonHTTP
  // porque la app usa transacciones interactivas (compras, trades, rate
  // limit), que el modo HTTP no soporta. En local (docker Postgres, host que
  // no es de Neon) se mantiene el cliente estándar sin cambios.
  if (connectionString && connectionString.includes("neon.tech")) {
    const adapter = new PrismaNeon({ connectionString });
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

// Evita crear una nueva instancia en cada hot-reload durante el desarrollo.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
