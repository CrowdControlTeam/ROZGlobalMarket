-- Backfill puntual: las publicaciones de cantidad ILIMITADA dejan de caducar.
--
-- Contexto: desde este cambio, crear/editar una publicación con quantity NULL
-- (ilimitada) la deja con expiresAt = NULL (= no caduca). Este backfill limpia
-- expiresAt en las ilimitadas que YA existían para que el cron
-- (status='ACTIVE' AND expiresAt <= now()) no las marque EXPIRED y el mercado
-- las siga mostrando (expiresAt IS NULL = nunca caduca).
--
-- Alcance: SOLO las ACTIVE. No se resucitan las que ya estén EXPIRED/COMPLETED/
-- CANCELLED (son estados terminales); esto solo evita caducidades FUTURAS.
--
-- Aplicar A MANO en dev Y prod al desplegar (como el resto de migraciones
-- manuales), p. ej.:
--   dotenvx run -f .env -- psql "$DATABASE_URL" -f scripts/backfill-unlimited-no-expiry.sql
-- Idempotente: re-ejecutarlo no cambia nada más (WHERE ya filtra las tocadas).

UPDATE "Listing"
SET "expiresAt" = NULL
WHERE quantity IS NULL
  AND status = 'ACTIVE'
  AND "expiresAt" IS NOT NULL;
