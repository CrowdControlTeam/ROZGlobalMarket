-- Limpieza (Fase 6b): se elimina el contador denormalizado quantitySold. Lo
-- vendido/entregado/cumplido pasa a calcularse de los Deal ACCEPTED (ver
-- deals.ts / getListings / getMyListings / ListingDetailContent).
-- AlterTable
ALTER TABLE "Listing" DROP COLUMN "quantitySold";
