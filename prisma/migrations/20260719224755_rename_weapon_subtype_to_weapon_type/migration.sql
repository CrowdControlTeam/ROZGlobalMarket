-- Renombra weaponSubtype -> weaponType en todo el esquema, escrito a mano
-- como RENAME en vez de dejar que `prisma migrate dev` genere su diff por
-- defecto (que habría hecho DROP + CREATE, perdiendo los 361 valores ya
-- clasificados en Item.weaponSubtype y las 3 filas de MagicalWeaponSubtype).

-- RenameEnum
ALTER TYPE "WeaponSubtype" RENAME TO "WeaponType";

-- RenameColumn
ALTER TABLE "Item" RENAME COLUMN "weaponSubtype" TO "weaponType";

-- RenameTable
ALTER TABLE "MagicalWeaponSubtype" RENAME TO "MagicalWeaponType";

-- RenameColumn
ALTER TABLE "MagicalWeaponType" RENAME COLUMN "subtype" TO "type";

-- RenameConstraint (para que coincida con el nombre que Prisma espera para la tabla renombrada)
ALTER TABLE "MagicalWeaponType" RENAME CONSTRAINT "MagicalWeaponSubtype_pkey" TO "MagicalWeaponType_pkey";
