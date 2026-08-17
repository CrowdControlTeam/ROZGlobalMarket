-- AlterEnum
-- Los tocados dejan de tener tiers (UPPER/MID/LOWER) y se unifican en HEADGEAR.
-- El CASE en el USING remapea esos valores en DBs ya pobladas (dev) para que el
-- cast no falle; en una DB vacía (prod) es inocuo. El valor destino es temporal:
-- importItems.mjs reescribe cada item con su slot correcto después.
BEGIN;
CREATE TYPE "EquipSlot_new" AS ENUM ('HEADGEAR', 'ARMOR', 'SHIELD', 'GARMENT', 'FOOTGEAR', 'ACCESSORY', 'WEAPON');
ALTER TABLE "Item" ALTER COLUMN "slot" TYPE "EquipSlot_new" USING (
  CASE "slot"::text
    WHEN 'UPPER_HEADGEAR' THEN 'HEADGEAR'
    WHEN 'MID_HEADGEAR'   THEN 'HEADGEAR'
    WHEN 'LOWER_HEADGEAR' THEN 'HEADGEAR'
    ELSE "slot"::text
  END::"EquipSlot_new"
);
ALTER TABLE "BisEntry" ALTER COLUMN "slot" TYPE "EquipSlot_new" USING (
  CASE "slot"::text
    WHEN 'UPPER_HEADGEAR' THEN 'HEADGEAR'
    WHEN 'MID_HEADGEAR'   THEN 'HEADGEAR'
    WHEN 'LOWER_HEADGEAR' THEN 'HEADGEAR'
    ELSE "slot"::text
  END::"EquipSlot_new"
);
ALTER TYPE "EquipSlot" RENAME TO "EquipSlot_old";
ALTER TYPE "EquipSlot_new" RENAME TO "EquipSlot";
DROP TYPE "public"."EquipSlot_old";
COMMIT;

-- AlterEnum
-- Categorías nuevas (14). El CASE remapea los valores viejos que ya no existen
-- (CONSUMABLE, PET) en DBs pobladas; no-op en prod (vacío). Temporal: el import
-- reescribe la categoría real de cada item.
BEGIN;
CREATE TYPE "ItemCategory_new" AS ENUM ('WEAPON', 'ARMOR', 'CARD', 'ENCHANT', 'COSTUME', 'HEALING', 'USABLE', 'DELAY_CONSUME', 'AMMO', 'ETC', 'PET_EGG', 'PET_ARMOR', 'CASH', 'GET_PORING');
ALTER TABLE "Item" ALTER COLUMN "category" TYPE "ItemCategory_new" USING (
  CASE "category"::text
    WHEN 'CONSUMABLE' THEN 'USABLE'
    WHEN 'PET'        THEN 'PET_ARMOR'
    ELSE "category"::text
  END::"ItemCategory_new"
);
ALTER TYPE "ItemCategory" RENAME TO "ItemCategory_old";
ALTER TYPE "ItemCategory_new" RENAME TO "ItemCategory";
DROP TYPE "public"."ItemCategory_old";
COMMIT;

-- AlterTable
ALTER TABLE "BisEntry" DROP COLUMN "cardSlots";

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "sourceUrl",
DROP COLUMN "verified",
ADD COLUMN     "armorLevel" INTEGER,
ADD COLUMN     "attack" INTEGER,
ADD COLUMN     "cardSlot" TEXT,
ADD COLUMN     "categorySource" TEXT,
ADD COLUMN     "classNum" INTEGER,
ADD COLUMN     "cooldown" TEXT,
ADD COLUMN     "costume" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defense" INTEGER,
ADD COLUMN     "effectId" INTEGER,
ADD COLUMN     "element" TEXT,
ADD COLUMN     "itemType" TEXT,
ADD COLUMN     "jobs" TEXT,
ADD COLUMN     "petTarget" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "requiredLevel" INTEGER,
ADD COLUMN     "restrictions" JSONB,
ADD COLUMN     "slotCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subType" TEXT,
ADD COLUMN     "tradeable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "unidentifiedName" TEXT,
ADD COLUMN     "weaponLevel" INTEGER,
ADD COLUMN     "weight" INTEGER,
DROP COLUMN "description",
ADD COLUMN     "description" TEXT[];

-- AlterTable
ALTER TABLE "Listing" DROP COLUMN "cardSlots";

-- CreateIndex
CREATE INDEX "Item_tradeable_idx" ON "Item"("tradeable");


-- AlterTable
ALTER TABLE "Deal" DROP COLUMN "offeredCardSlots";
