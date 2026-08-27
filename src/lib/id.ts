import { nanoid } from "nanoid";

// Generates the id for new rows. Replaces Prisma's client-side `@default(cuid())`
// (the DB column has no default): Drizzle fills it via `$defaultFn(createId)` in
// the schema. Opaque, URL-safe ids (they appear in routes like /market/<id>).
export const createId = (): string => nanoid();
