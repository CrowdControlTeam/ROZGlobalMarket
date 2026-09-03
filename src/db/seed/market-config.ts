// Seeds the single MarketConfig row (id=1) if it doesn't exist yet. Idempotent
// (doesn't overwrite maxRefineLevel if it was already tweaked by hand).
//
// Usage: npm run seed:config   (or dotenvx run -f .env.dev -- npm run seed:config)

import { eq } from "drizzle-orm";
import { marketConfig } from "../schema";
import { db, runSeed } from "./client";

runSeed(async () => {
  await db.insert(marketConfig).values({ id: 1, maxRefineLevel: 10 }).onConflictDoNothing();
  const [config] = await db.select().from(marketConfig).where(eq(marketConfig.id, 1)).limit(1);
  console.log("MarketConfig:", config);
});
