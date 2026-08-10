-- CreateEnum
CREATE TYPE "JobTier" AS ENUM ('FIRST', 'SECOND', 'THIRD');

-- AlterTable
ALTER TABLE "MarketConfig" ADD COLUMN     "bisEditorRoleId" TEXT;

-- CreateTable
CREATE TABLE "BisStage" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BisStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CombatRole" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CombatRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tier" "JobTier" NOT NULL DEFAULT 'FIRST',
    "parentJobId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BisEntry" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "slot" "EquipSlot" NOT NULL,
    "itemId" TEXT,
    "refineLevel" INTEGER,
    "cardSlots" INTEGER,
    "note" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BisEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BisEntryOption" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "defId" TEXT NOT NULL,
    "minValue" INTEGER,

    CONSTRAINT "BisEntryOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BisEntryToCombatRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BisEntryToCombatRole_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BisEntryToJob" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BisEntryToJob_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "BisStage_key_key" ON "BisStage"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CombatRole_key_key" ON "CombatRole"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Job_key_key" ON "Job"("key");

-- CreateIndex
CREATE INDEX "BisEntry_stageId_slot_position_idx" ON "BisEntry"("stageId", "slot", "position");

-- CreateIndex
CREATE UNIQUE INDEX "BisEntryOption_entryId_slotIndex_key" ON "BisEntryOption"("entryId", "slotIndex");

-- CreateIndex
CREATE INDEX "_BisEntryToCombatRole_B_index" ON "_BisEntryToCombatRole"("B");

-- CreateIndex
CREATE INDEX "_BisEntryToJob_B_index" ON "_BisEntryToJob"("B");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BisEntry" ADD CONSTRAINT "BisEntry_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "BisStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BisEntry" ADD CONSTRAINT "BisEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BisEntry" ADD CONSTRAINT "BisEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BisEntryOption" ADD CONSTRAINT "BisEntryOption_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "BisEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BisEntryOption" ADD CONSTRAINT "BisEntryOption_defId_fkey" FOREIGN KEY ("defId") REFERENCES "ItemOptionDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BisEntryToCombatRole" ADD CONSTRAINT "_BisEntryToCombatRole_A_fkey" FOREIGN KEY ("A") REFERENCES "BisEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BisEntryToCombatRole" ADD CONSTRAINT "_BisEntryToCombatRole_B_fkey" FOREIGN KEY ("B") REFERENCES "CombatRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BisEntryToJob" ADD CONSTRAINT "_BisEntryToJob_A_fkey" FOREIGN KEY ("A") REFERENCES "BisEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BisEntryToJob" ADD CONSTRAINT "_BisEntryToJob_B_fkey" FOREIGN KEY ("B") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
