// Seeds MagicalWeaponType with the default weapon types that count as "magical
// weapons" (WEAPON_MAGICAL pool). Idempotent (onConflictDoNothing).
//
// Usage: npm run seed:magical

import { magicalWeaponType, type WeaponType } from "../schema";
import { db, runSeed } from "./client";

const DEFAULT_MAGICAL_TYPES: WeaponType[] = ["ROD", "TWO_HAND_ROD", "BOOK"];

runSeed(async () => {
  const result = await db
    .insert(magicalWeaponType)
    .values(DEFAULT_MAGICAL_TYPES.map((type) => ({ type })))
    .onConflictDoNothing()
    .returning();
  console.log(`Inserted: ${result.length} (of ${DEFAULT_MAGICAL_TYPES.length} defaults).`);
});
