CREATE TABLE "ListingCard" (
	"id" text NOT NULL,
	"listingId" text NOT NULL,
	"slotIndex" integer NOT NULL,
	"cardItemId" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ListingCard" ADD CONSTRAINT "ListingCard_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "ListingCard" ADD CONSTRAINT "ListingCard_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ListingCard" ADD CONSTRAINT "ListingCard_cardItemId_fkey" FOREIGN KEY ("cardItemId") REFERENCES "public"."Item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "ListingCard_listingId_slotIndex_key" ON "ListingCard" USING btree ("listingId" text_ops,"slotIndex" int4_ops);
