ALTER TABLE "BuildEntry" DROP CONSTRAINT IF EXISTS "BuildEntry_itemId_fkey";--> statement-breakpoint
ALTER TABLE "BuildEntryCard" DROP CONSTRAINT IF EXISTS "BuildEntryCard_cardItemId_fkey";--> statement-breakpoint
ALTER TABLE "Deal" DROP CONSTRAINT IF EXISTS "Deal_offeredItemId_fkey";--> statement-breakpoint
ALTER TABLE "Listing" DROP CONSTRAINT IF EXISTS "Listing_itemId_fkey";--> statement-breakpoint
ALTER TABLE "ListingCard" DROP CONSTRAINT IF EXISTS "ListingCard_cardItemId_fkey";--> statement-breakpoint
DROP TABLE IF EXISTS "Item" CASCADE;
