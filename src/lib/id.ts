import { nanoid } from "nanoid";

// Genera el id de las filas nuevas. Sustituye al `@default(cuid())` que Prisma
// aplicaba en el cliente (la columna en la DB no tiene default): Drizzle lo
// rellena vía `$defaultFn(createId)` en el schema. IDs opacos y URL-safe (van
// en rutas como /market/<id>).
export const createId = (): string => nanoid();
