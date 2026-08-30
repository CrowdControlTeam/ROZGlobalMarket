ALTER TABLE "Listing" ADD COLUMN "expiresAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "MarketConfig" ADD COLUMN "listingExpirationDays" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
CREATE INDEX "Listing_status_expiresAt_idx" ON "Listing" USING btree ("status" enum_ops,"expiresAt" timestamp_ops);--> statement-breakpoint
-- Backfill: las publicaciones ya ACTIVE arrancan su caducidad en el deploy,
-- a listingExpirationDays (config, default 7) días vista. Las que no son
-- ACTIVE se quedan con expiresAt NULL (no caducan; ya están cerradas).
UPDATE "Listing"
SET "expiresAt" = now() + make_interval(days => COALESCE((SELECT "listingExpirationDays" FROM "MarketConfig" LIMIT 1), 7))
WHERE "status" = 'ACTIVE' AND "expiresAt" IS NULL;