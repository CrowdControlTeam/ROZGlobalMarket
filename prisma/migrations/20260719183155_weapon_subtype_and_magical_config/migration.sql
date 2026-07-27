/*
  Warnings:

  - You are about to drop the column `weaponAttackType` on the `Item` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "WeaponSubtype" AS ENUM ('DAGGER', 'ONE_HAND_SWORD', 'TWO_HAND_SWORD', 'ONE_HAND_SPEAR', 'TWO_HAND_SPEAR', 'ONE_HAND_AXE', 'TWO_HAND_AXE', 'MACE', 'ROD', 'TWO_HAND_ROD', 'BOW', 'KNUCKLE', 'INSTRUMENT', 'WHIP', 'BOOK', 'KATAR', 'REVOLVER', 'RIFLE', 'GATLING_GUN', 'SHOTGUN', 'GRENADE_LAUNCHER', 'FUUMA_SHURIKEN');

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "weaponAttackType",
ADD COLUMN     "weaponSubtype" "WeaponSubtype";

-- DropEnum
DROP TYPE "WeaponAttackType";

-- CreateTable
CREATE TABLE "MagicalWeaponSubtype" (
    "subtype" "WeaponSubtype" NOT NULL,

    CONSTRAINT "MagicalWeaponSubtype_pkey" PRIMARY KEY ("subtype")
);
