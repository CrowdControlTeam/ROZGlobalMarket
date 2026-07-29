-- Listing.quantity pasa a nullable: null = ILIMITADO ("los que tengas"), solo
-- en SALE/BUY de materiales. Ver deals.ts / el rediseño.
-- AlterTable
ALTER TABLE "Listing" ALTER COLUMN "quantity" DROP NOT NULL,
ALTER COLUMN "quantity" DROP DEFAULT;
