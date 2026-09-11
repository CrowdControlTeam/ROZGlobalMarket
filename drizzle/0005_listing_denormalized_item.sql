ALTER TABLE "Listing" ADD COLUMN "itemName" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "Listing" ADD COLUMN "itemCategory" "ItemCategory" DEFAULT 'ETC' NOT NULL;--> statement-breakpoint
ALTER TABLE "Listing" ADD COLUMN "itemSlot" "EquipSlot";--> statement-breakpoint
ALTER TABLE "Listing" ADD COLUMN "itemWeaponType" "WeaponType";--> statement-breakpoint
ALTER TABLE "Listing" ADD COLUMN "itemSlotCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "Listing_itemName_idx" ON "Listing" USING btree ("itemName" text_ops);--> statement-breakpoint
UPDATE "Listing" l SET
	"itemName" = i."name",
	"itemCategory" = i."category",
	"itemSlot" = i."slot",
	"itemWeaponType" = i."weaponType",
	"itemSlotCount" = i."slotCount"
FROM "Item" i WHERE l."itemId" = i."id";