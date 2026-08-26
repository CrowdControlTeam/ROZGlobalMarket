// Puebla MagicalWeaponType con los tipos de arma por defecto que cuentan como
// "arma mágica" (pool WEAPON_MAGICAL). Idempotente (onConflictDoNothing).
//
// Uso: npm run seed:magical

import { magicalWeaponType, type WeaponType } from "../schema";
import { db, runSeed } from "./client";

const DEFAULT_MAGICAL_TYPES: WeaponType[] = ["ROD", "TWO_HAND_ROD", "BOOK"];

runSeed(async () => {
  const result = await db
    .insert(magicalWeaponType)
    .values(DEFAULT_MAGICAL_TYPES.map((type) => ({ type })))
    .onConflictDoNothing()
    .returning();
  console.log(`Insertados: ${result.length} (de ${DEFAULT_MAGICAL_TYPES.length} por defecto).`);
});
