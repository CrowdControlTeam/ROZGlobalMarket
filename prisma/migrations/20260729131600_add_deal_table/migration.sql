-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'PENDING',
    "unitPrice" INTEGER,
    "offeredItemId" TEXT,
    "offeredRefine" INTEGER,
    "offeredCardSlots" INTEGER,
    "zenyOffered" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_listingId_status_idx" ON "Deal"("listingId", "status");

-- CreateIndex
CREATE INDEX "Deal_userId_idx" ON "Deal"("userId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_offeredItemId_fkey" FOREIGN KEY ("offeredItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
