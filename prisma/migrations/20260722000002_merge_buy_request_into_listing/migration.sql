-- Paso 2/2: renombra Listing.sellerId a posterId (nombre neutro: en un
-- listing type=BUY esa persona es quien compra, no quien vende), migra las
-- filas de BuyRequest a Listing (type=BUY, price=maxPrice,
-- posterId=buyerId, status FULFILLED->SOLD ya que se reutiliza
-- ListingStatus), y elimina la tabla/enum ya fusionados.

ALTER TABLE "Listing" RENAME COLUMN "sellerId" TO "posterId";

INSERT INTO "Listing" (
  "id", "posterId", "itemId", "type", "quantity", "quantitySold",
  "price", "status", "createdAt", "updatedAt", "refineLevel", "cardSlots"
)
SELECT
  "id", "buyerId", "itemId", 'BUY', "quantity", 0,
  "maxPrice",
  CASE "status"
    WHEN 'ACTIVE' THEN 'ACTIVE'
    WHEN 'FULFILLED' THEN 'SOLD'
    WHEN 'CANCELLED' THEN 'CANCELLED'
  END::"ListingStatus",
  "createdAt", "updatedAt", 0, 0
FROM "BuyRequest";

DROP TABLE "BuyRequest";

DROP TYPE "BuyRequestStatus";
