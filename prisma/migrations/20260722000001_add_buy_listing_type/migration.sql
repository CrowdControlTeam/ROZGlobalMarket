-- Paso 1/2 de la fusión de BuyRequest en Listing: el valor nuevo del enum
-- tiene que confirmarse en su propia transacción antes de poder usarse en
-- un INSERT (restricción de Postgres sobre ALTER TYPE ... ADD VALUE).
ALTER TYPE "ListingType" ADD VALUE 'BUY';
