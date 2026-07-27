-- CreateEnum
CREATE TYPE "WeaponAttackType" AS ENUM ('PHYSICAL', 'MAGICAL');

-- CreateEnum
CREATE TYPE "ItemOptionGroup" AS ENUM ('ARMOR', 'GARMENT', 'FOOTGEAR', 'WEAPON_PHYSICAL', 'WEAPON_MAGICAL');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "weaponAttackType" "WeaponAttackType";

-- CreateTable
CREATE TABLE "ItemOptionDef" (
    "id" TEXT NOT NULL,
    "group" "ItemOptionGroup" NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "statCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minValue" INTEGER NOT NULL,
    "maxValue" INTEGER NOT NULL,

    CONSTRAINT "ItemOptionDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingOption" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "defId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "ListingOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemOptionDef_group_slotIndex_idx" ON "ItemOptionDef"("group", "slotIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ItemOptionDef_group_slotIndex_statCode_key" ON "ItemOptionDef"("group", "slotIndex", "statCode");

-- CreateIndex
CREATE UNIQUE INDEX "ListingOption_listingId_slotIndex_key" ON "ListingOption"("listingId", "slotIndex");

-- AddForeignKey
ALTER TABLE "ListingOption" ADD CONSTRAINT "ListingOption_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingOption" ADD CONSTRAINT "ListingOption_defId_fkey" FOREIGN KEY ("defId") REFERENCES "ItemOptionDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
