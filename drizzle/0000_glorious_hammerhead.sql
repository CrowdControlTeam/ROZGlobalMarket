-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."DealStatus" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."EquipSlot" AS ENUM('HEADGEAR', 'ARMOR', 'SHIELD', 'GARMENT', 'FOOTGEAR', 'ACCESSORY', 'WEAPON');--> statement-breakpoint
CREATE TYPE "public"."ItemCategory" AS ENUM('WEAPON', 'ARMOR', 'CARD', 'ENCHANT', 'COSTUME', 'HEALING', 'USABLE', 'DELAY_CONSUME', 'AMMO', 'ETC', 'PET_EGG', 'PET_ARMOR', 'CASH', 'GET_PORING');--> statement-breakpoint
CREATE TYPE "public"."ItemOptionGroup" AS ENUM('ARMOR', 'GARMENT', 'FOOTGEAR', 'WEAPON_PHYSICAL', 'WEAPON_MAGICAL');--> statement-breakpoint
CREATE TYPE "public"."JobTier" AS ENUM('FIRST', 'SECOND', 'THIRD');--> statement-breakpoint
CREATE TYPE "public"."ListingStatus" AS ENUM('ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."ListingType" AS ENUM('SALE', 'TRADE', 'BUY', 'GIFT');--> statement-breakpoint
CREATE TYPE "public"."WeaponType" AS ENUM('DAGGER', 'ONE_HAND_SWORD', 'TWO_HAND_SWORD', 'ONE_HAND_SPEAR', 'TWO_HAND_SPEAR', 'ONE_HAND_AXE', 'TWO_HAND_AXE', 'MACE', 'ROD', 'TWO_HAND_ROD', 'BOW', 'KNUCKLE', 'INSTRUMENT', 'WHIP', 'BOOK', 'KATAR', 'REVOLVER', 'RIFLE', 'GATLING_GUN', 'SHOTGUN', 'GRENADE_LAUNCHER', 'FUUMA_SHURIKEN');--> statement-breakpoint
CREATE TABLE "_prisma_migrations" (
	"id" varchar(36) NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"finished_at" timestamp with time zone,
	"migration_name" varchar(255) NOT NULL,
	"logs" text,
	"rolled_back_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_steps_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text NOT NULL,
	"username" text NOT NULL,
	"avatarUrl" text,
	"guildRoles" text[] DEFAULT '{"RAY"}',
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Listing" (
	"id" text NOT NULL,
	"posterId" text NOT NULL,
	"itemId" text NOT NULL,
	"quantity" integer,
	"price" integer,
	"status" "ListingStatus" DEFAULT 'ACTIVE' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"refineLevel" integer DEFAULT 0 NOT NULL,
	"type" "ListingType" DEFAULT 'SALE' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "ListingOption" (
	"id" text NOT NULL,
	"listingId" text NOT NULL,
	"slotIndex" integer NOT NULL,
	"defId" text NOT NULL,
	"value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ItemOptionDef" (
	"id" text NOT NULL,
	"group" "ItemOptionGroup" NOT NULL,
	"slotIndex" integer NOT NULL,
	"statCode" text NOT NULL,
	"label" text NOT NULL,
	"minValue" integer NOT NULL,
	"maxValue" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MagicalWeaponType" (
	"type" "WeaponType" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MarketConfig" (
	"id" integer DEFAULT 1 NOT NULL,
	"maxRefineLevel" integer DEFAULT 10 NOT NULL,
	"imageRecognitionEnabled" boolean DEFAULT false NOT NULL,
	"maintenanceModeEnabled" boolean DEFAULT false NOT NULL,
	"webhookEnabled" boolean DEFAULT false NOT NULL,
	"webhookUrl" text,
	"optionsEnabled" boolean DEFAULT true NOT NULL,
	"adminRoleIds" text[] DEFAULT '{"RAY"}',
	"geminiModel" text DEFAULT 'gemini-flash-latest' NOT NULL,
	"dmNotificationsEnabled" boolean DEFAULT true NOT NULL,
	"siteName" text,
	"homeImageUrl" text,
	"logoUrl" text,
	"accessRoleId" text,
	"bisEditorRoleId" text
);
--> statement-breakpoint
CREATE TABLE "RateLimit" (
	"key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"windowStart" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Job" (
	"id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"tier" "JobTier" DEFAULT 'FIRST' NOT NULL,
	"parentJobId" text,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BisStage" (
	"id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BisEntryOption" (
	"id" text NOT NULL,
	"entryId" text NOT NULL,
	"slotIndex" integer NOT NULL,
	"defId" text NOT NULL,
	"minValue" integer
);
--> statement-breakpoint
CREATE TABLE "_BisEntryToCombatRole" (
	"A" text NOT NULL,
	"B" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "CombatRole" (
	"id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_BisEntryToJob" (
	"A" text NOT NULL,
	"B" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Deal" (
	"id" text NOT NULL,
	"listingId" text NOT NULL,
	"userId" text NOT NULL,
	"quantity" integer NOT NULL,
	"status" "DealStatus" DEFAULT 'PENDING' NOT NULL,
	"unitPrice" integer,
	"offeredItemId" text,
	"offeredRefine" integer,
	"zenyOffered" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"offeredQuantity" integer
);
--> statement-breakpoint
CREATE TABLE "SavedSearch" (
	"id" text NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"filters" text NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Item" (
	"id" text NOT NULL,
	"name" text NOT NULL,
	"category" "ItemCategory" NOT NULL,
	"slot" "EquipSlot",
	"iconUrl" text NOT NULL,
	"importedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"weaponType" "WeaponType",
	"armorLevel" integer,
	"attack" integer,
	"cardSlot" text,
	"categorySource" text,
	"classNum" integer,
	"cooldown" text,
	"costume" boolean DEFAULT false NOT NULL,
	"defense" integer,
	"effectId" integer,
	"element" text,
	"itemType" text,
	"jobs" text,
	"petTarget" text,
	"position" text,
	"requiredLevel" integer,
	"restrictions" jsonb,
	"slotCount" integer DEFAULT 0 NOT NULL,
	"subType" text,
	"tradeable" boolean DEFAULT true NOT NULL,
	"unidentifiedName" text,
	"weaponLevel" integer,
	"weight" integer,
	"description" text[]
);
--> statement-breakpoint
CREATE TABLE "BisEntry" (
	"id" text NOT NULL,
	"stageId" text NOT NULL,
	"slot" "EquipSlot" NOT NULL,
	"itemId" text,
	"refineLevel" integer,
	"note" text,
	"position" integer DEFAULT 0 NOT NULL,
	"createdById" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"weaponType" "WeaponType"
);
--> statement-breakpoint
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."Item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ListingOption" ADD CONSTRAINT "ListingOption_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ListingOption" ADD CONSTRAINT "ListingOption_defId_fkey" FOREIGN KEY ("defId") REFERENCES "public"."ItemOptionDef"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Job" ADD CONSTRAINT "Job_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "public"."Job"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BisEntryOption" ADD CONSTRAINT "BisEntryOption_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."BisEntry"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BisEntryOption" ADD CONSTRAINT "BisEntryOption_defId_fkey" FOREIGN KEY ("defId") REFERENCES "public"."ItemOptionDef"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_BisEntryToCombatRole" ADD CONSTRAINT "_BisEntryToCombatRole_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."BisEntry"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_BisEntryToCombatRole" ADD CONSTRAINT "_BisEntryToCombatRole_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."CombatRole"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_BisEntryToJob" ADD CONSTRAINT "_BisEntryToJob_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."BisEntry"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_BisEntryToJob" ADD CONSTRAINT "_BisEntryToJob_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Job"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_offeredItemId_fkey" FOREIGN KEY ("offeredItemId") REFERENCES "public"."Item"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BisEntry" ADD CONSTRAINT "BisEntry_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."BisStage"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BisEntry" ADD CONSTRAINT "BisEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."Item"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BisEntry" ADD CONSTRAINT "BisEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "Listing_price_idx" ON "Listing" USING btree ("price" int4_ops);--> statement-breakpoint
CREATE INDEX "Listing_status_createdAt_idx" ON "Listing" USING btree ("status" timestamp_ops,"createdAt" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ListingOption_listingId_slotIndex_key" ON "ListingOption" USING btree ("listingId" int4_ops,"slotIndex" int4_ops);--> statement-breakpoint
CREATE INDEX "ItemOptionDef_group_slotIndex_idx" ON "ItemOptionDef" USING btree ("group" enum_ops,"slotIndex" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ItemOptionDef_group_slotIndex_statCode_key" ON "ItemOptionDef" USING btree ("group" text_ops,"slotIndex" text_ops,"statCode" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Job_key_key" ON "Job" USING btree ("key" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "BisStage_key_key" ON "BisStage" USING btree ("key" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "BisEntryOption_entryId_slotIndex_key" ON "BisEntryOption" USING btree ("entryId" int4_ops,"slotIndex" int4_ops);--> statement-breakpoint
CREATE INDEX "_BisEntryToCombatRole_B_index" ON "_BisEntryToCombatRole" USING btree ("B" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "CombatRole_key_key" ON "CombatRole" USING btree ("key" text_ops);--> statement-breakpoint
CREATE INDEX "_BisEntryToJob_B_index" ON "_BisEntryToJob" USING btree ("B" text_ops);--> statement-breakpoint
CREATE INDEX "Deal_listingId_status_idx" ON "Deal" USING btree ("listingId" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "Deal_userId_idx" ON "Deal" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "Item_category_slot_idx" ON "Item" USING btree ("category" enum_ops,"slot" enum_ops);--> statement-breakpoint
CREATE INDEX "Item_name_idx" ON "Item" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "Item_tradeable_idx" ON "Item" USING btree ("tradeable" bool_ops);--> statement-breakpoint
CREATE INDEX "BisEntry_stageId_slot_position_idx" ON "BisEntry" USING btree ("stageId" int4_ops,"slot" int4_ops,"position" int4_ops);
*/