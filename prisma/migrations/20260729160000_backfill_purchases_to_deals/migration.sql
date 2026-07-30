-- Backfill (cutover SALE -> Deal): cada Purchase histórica se copia a un Deal
-- ACCEPTED equivalente (la compra directa pasa a registrarse como Deal, no como
-- Purchase). Las Purchase NO se borran aquí (se retiran en la limpieza final,
-- Fase 6). Migración de SOLO datos (sin cambio de schema). unitPrice se conserva;
-- el id es opaco (un UUID vale; los nuevos Deal usan cuid). updatedAt = createdAt
-- (Purchase no tiene updatedAt).
INSERT INTO "Deal" (
  "id", "listingId", "userId", "quantity", "status", "unitPrice", "zenyOffered",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  "listingId",
  "buyerId",
  "quantity",
  'ACCEPTED'::"DealStatus",
  "unitPrice",
  0,
  "createdAt",
  "createdAt"
FROM "Purchase";
