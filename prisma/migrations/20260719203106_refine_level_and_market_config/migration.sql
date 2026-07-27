-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "refineLevel" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MarketConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "maxRefineLevel" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "MarketConfig_pkey" PRIMARY KEY ("id")
);
