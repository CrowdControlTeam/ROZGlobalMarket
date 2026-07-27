-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SALE', 'TRADE');

-- CreateEnum
CREATE TYPE "TradeOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "type" "ListingType" NOT NULL DEFAULT 'SALE',
ALTER COLUMN "price" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TradeOffer" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "offererId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "refineLevel" INTEGER NOT NULL DEFAULT 0,
    "cardSlots" INTEGER NOT NULL DEFAULT 0,
    "zenyOffered" INTEGER NOT NULL DEFAULT 0,
    "status" "TradeOfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeOffer_listingId_status_idx" ON "TradeOffer"("listingId", "status");

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_offererId_fkey" FOREIGN KEY ("offererId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
