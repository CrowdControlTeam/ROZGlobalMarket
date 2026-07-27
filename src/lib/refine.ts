import { prisma } from "@/lib/prisma";
import { DEFAULT_MAX_REFINE_LEVEL } from "@/lib/refine-constants";

export { isRefineEligible, formatRefinedName, DEFAULT_MAX_REFINE_LEVEL } from "@/lib/refine-constants";

// MarketConfig es una fila única (id=1) sembrada por prisma/seedMarketConfig.mjs.
// Si por lo que sea no existe todavía, cae al valor por defecto en vez de
// romper la creación/filtrado de listings.
export async function loadMaxRefineLevel(): Promise<number> {
  const config = await prisma.marketConfig.findUnique({ where: { id: 1 } });
  return config?.maxRefineLevel ?? DEFAULT_MAX_REFINE_LEVEL;
}
