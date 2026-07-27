-- AlterTable
ALTER TABLE "MarketConfig" ADD COLUMN     "adminRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
