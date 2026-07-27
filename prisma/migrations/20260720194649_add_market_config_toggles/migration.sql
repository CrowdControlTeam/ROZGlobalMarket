-- AlterTable
ALTER TABLE "MarketConfig" ADD COLUMN     "imageRecognitionEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maintenanceModeEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "webhookEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "webhookUrl" TEXT;
