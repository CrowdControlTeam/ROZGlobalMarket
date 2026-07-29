-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "offeredQuantity" INTEGER;

-- Backfill (cutover TRADE -> Deal): cada TradeOffer histórico se copia a un Deal
-- equivalente, porque el flujo de trade pasa a operar sobre Deal. Las TradeOffer
-- NO se borran aquí (se conservan hasta la limpieza final, Fase 6). En un trade
-- `quantity` = unidades del listing = 1; la cantidad del item ofrecido va en
-- offeredQuantity. El estado se castea vía texto (TradeOfferStatus y DealStatus
-- comparten etiquetas). id: un UUID sirve (el id es opaco; los nuevos usan cuid).
INSERT INTO "Deal" (
  "id", "listingId", "userId", "quantity", "status", "unitPrice",
  "offeredItemId", "offeredQuantity", "offeredRefine", "offeredCardSlots",
  "zenyOffered", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  "listingId",
  "offererId",
  1,
  "status"::text::"DealStatus",
  NULL,
  "itemId",
  "quantity",
  "refineLevel",
  "cardSlots",
  "zenyOffered",
  "createdAt",
  "updatedAt"
FROM "TradeOffer";
