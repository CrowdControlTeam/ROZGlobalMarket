-- Limpieza (Fase 6c): se borran las tablas que Deal ya sustituyó (Purchase,
-- TradeOffer, Gift, GiftOption) y se quita el valor SOLD del enum ListingStatus
-- (sustituido por COMPLETED). En este entorno no hay datos, pero la migración
-- es robusta igualmente.

-- Migra defensivamente cualquier estado SOLD histórico a COMPLETED antes de
-- recrear el enum sin SOLD (Postgres no permite DROP VALUE: hay que recrear el
-- tipo, y el cast fallaría si quedara alguna fila con SOLD).
UPDATE "Listing" SET "status" = 'COMPLETED' WHERE "status" = 'SOLD';

-- AlterEnum: ListingStatus sin SOLD
BEGIN;
CREATE TYPE "ListingStatus_new" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');
ALTER TABLE "public"."Listing" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Listing" ALTER COLUMN "status" TYPE "ListingStatus_new" USING ("status"::text::"ListingStatus_new");
ALTER TYPE "ListingStatus" RENAME TO "ListingStatus_old";
ALTER TYPE "ListingStatus_new" RENAME TO "ListingStatus";
DROP TYPE "public"."ListingStatus_old";
ALTER TABLE "Listing" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- DropForeignKey
ALTER TABLE "Gift" DROP CONSTRAINT "Gift_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Gift" DROP CONSTRAINT "Gift_recipientId_fkey";

-- DropForeignKey
ALTER TABLE "Gift" DROP CONSTRAINT "Gift_senderId_fkey";

-- DropForeignKey
ALTER TABLE "GiftOption" DROP CONSTRAINT "GiftOption_defId_fkey";

-- DropForeignKey
ALTER TABLE "GiftOption" DROP CONSTRAINT "GiftOption_giftId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_listingId_fkey";

-- DropForeignKey
ALTER TABLE "TradeOffer" DROP CONSTRAINT "TradeOffer_itemId_fkey";

-- DropForeignKey
ALTER TABLE "TradeOffer" DROP CONSTRAINT "TradeOffer_listingId_fkey";

-- DropForeignKey
ALTER TABLE "TradeOffer" DROP CONSTRAINT "TradeOffer_offererId_fkey";

-- DropTable
DROP TABLE "Gift";

-- DropTable
DROP TABLE "GiftOption";

-- DropTable
DROP TABLE "Purchase";

-- DropTable
DROP TABLE "TradeOffer";

-- DropEnum
DROP TYPE "TradeOfferStatus";
