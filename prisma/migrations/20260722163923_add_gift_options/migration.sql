-- CreateTable
CREATE TABLE "GiftOption" (
    "id" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "defId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "GiftOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftOption_giftId_slotIndex_key" ON "GiftOption"("giftId", "slotIndex");

-- AddForeignKey
ALTER TABLE "GiftOption" ADD CONSTRAINT "GiftOption_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "Gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftOption" ADD CONSTRAINT "GiftOption_defId_fkey" FOREIGN KEY ("defId") REFERENCES "ItemOptionDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
