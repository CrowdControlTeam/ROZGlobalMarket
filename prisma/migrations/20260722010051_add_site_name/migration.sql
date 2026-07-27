-- AlterTable
ALTER TABLE "MarketConfig" ADD COLUMN     "siteName" TEXT;

-- RenameForeignKey
ALTER TABLE "Listing" RENAME CONSTRAINT "Listing_sellerId_fkey" TO "Listing_posterId_fkey";
