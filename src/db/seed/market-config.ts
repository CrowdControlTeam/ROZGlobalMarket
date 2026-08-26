// Puebla la fila única de MarketConfig (id=1) si no existe. Idempotente
// (no pisa maxRefineLevel si ya se ajustó a mano).
//
// Uso: npm run seed:config   (o dotenvx run -f .env.dev -- npm run seed:config)

import { eq } from "drizzle-orm";
import { marketConfig } from "../schema";
import { db, runSeed } from "./client";

runSeed(async () => {
  await db.insert(marketConfig).values({ id: 1, maxRefineLevel: 10 }).onConflictDoNothing();
  const [config] = await db.select().from(marketConfig).where(eq(marketConfig.id, 1)).limit(1);
  console.log("MarketConfig:", config);
});
