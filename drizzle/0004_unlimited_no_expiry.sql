-- Data-only: corrige la caducidad de las publicaciones ILIMITADAS.
--
-- La migración 0001 (listing_expiration) puso expiresAt a TODAS las ACTIVE al
-- desplegar, sin excluir las de cantidad ilimitada (quantity NULL). Desde la
-- regla "las ilimitadas no caducan" (createListing/updateListing), esas no deben
-- tener caducidad. Aquí se les pone expiresAt = NULL. Va como migración (no como
-- script suelto) para que `db:migrate` lo aplique en el mismo paso, sin depender
-- de acordarse de un backfill manual. Idempotente.
UPDATE "Listing"
SET "expiresAt" = NULL
WHERE quantity IS NULL
  AND status = 'ACTIVE'
  AND "expiresAt" IS NOT NULL;
