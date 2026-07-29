-- Backfill (cutover GIFT -> Listing+Deal): cada Gift histórico pasa a un
-- Listing(type=GIFT, COMPLETED) + un Deal ACCEPTED para el destinatario. Va en
-- una migración APARTE del ADD VALUE 'GIFT' porque Postgres no deja usar un
-- valor de enum recién añadido en la misma transacción. Las tablas
-- Gift/GiftOption NO se borran (se retiran en la Fase 6).
--
-- Se reutiliza el id del Gift como id del Listing (ambos cuid, únicos) para
-- mapear trivialmente sus opciones. price siempre null (un regalo no tiene
-- precio); quantitySold = quantity (el regalo se entrega entero).
INSERT INTO "Listing" (
  "id", "posterId", "itemId", "type", "quantity", "quantitySold", "price",
  "status", "refineLevel", "cardSlots", "createdAt", "updatedAt"
)
SELECT
  "id", "senderId", "itemId", 'GIFT'::"ListingType", "quantity", "quantity", NULL,
  'COMPLETED'::"ListingStatus", "refineLevel", "cardSlots", "createdAt", "createdAt"
FROM "Gift";

-- El destinatario del regalo pasa a ser la contraparte de un Deal ya cerrado.
INSERT INTO "Deal" (
  "id", "listingId", "userId", "quantity", "status", "unitPrice", "zenyOffered",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text, "id", "recipientId", "quantity", 'ACCEPTED'::"DealStatus", NULL, 0,
  "createdAt", "createdAt"
FROM "Gift";

-- GiftOption -> ListingOption (listingId = Gift.id = nuevo Listing.id).
INSERT INTO "ListingOption" ("id", "listingId", "slotIndex", "defId", "value")
SELECT gen_random_uuid()::text, "giftId", "slotIndex", "defId", "value"
FROM "GiftOption";
