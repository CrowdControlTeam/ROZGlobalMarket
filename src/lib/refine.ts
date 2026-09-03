import { eq } from "drizzle-orm";
import { db } from "@/db";
import { marketConfig } from "@/db/schema";
import { DEFAULT_MAX_REFINE_LEVEL } from "@/lib/refine-constants";

export { isRefineEligible, formatRefinedName, DEFAULT_MAX_REFINE_LEVEL } from "@/lib/refine-constants";

// MarketConfig es una fila única (id=1) sembrada por prisma/seedMarketConfig.mjs.
// Si por lo que sea no existe todavía, cae al valor por defecto en vez de
// romper la creación/filtrado de listings.
export async function loadMaxRefineLevel(): Promise<number> {
  const rows = await db.select({ maxRefineLevel: marketConfig.maxRefineLevel })
    .from(marketConfig)
    .where(eq(marketConfig.id, 1))
    .limit(1);
  return rows[0]?.maxRefineLevel ?? DEFAULT_MAX_REFINE_LEVEL;
}
