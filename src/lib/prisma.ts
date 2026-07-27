import { PrismaClient } from "@prisma/client";

// Prisma lee las cadenas de conexión de DATABASE_URL (pooled, uso normal de
// la app) y DIRECT_URL (directa, solo la necesita `prisma migrate`) — ver
// `url`/`directUrl` en schema.prisma. Se toman tal cual del entorno:
//   - Local: apuntan al Postgres de docker-compose (ver .env.example).
//   - Producción (Neon): DATABASE_URL usa el endpoint pooled de Neon y
//     DIRECT_URL el directo; ambas se configuran como variables de entorno
//     del despliegue (ver .env.example).
// El adaptador de Cloudflare Workers (OpenNext + driver de Neon) se añadirá
// en una fase posterior; hasta entonces esto es un cliente Prisma estándar.

// Evita crear una nueva instancia en cada hot-reload durante el desarrollo.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
