-- Reemplazo de BiS por Builds. Se dropean todas las tablas de BiS (y Job, que
-- era solo de BiS; el skill planner usa el JSON, no esta tabla) y la columna
-- bisEditorRoleId; se crean las tablas de builds + enums + maxBuildsPerUser.
-- Las 2 entradas BiS actuales se pierden a propósito (acordado).

-- 1) Drops de BiS (hijos → padres) --------------------------------------------
DROP TABLE "_BisEntryToCombatRole";--> statement-breakpoint
DROP TABLE "_BisEntryToJob";--> statement-breakpoint
DROP TABLE "BisEntryOption";--> statement-breakpoint
DROP TABLE "BisEntry";--> statement-breakpoint
DROP TABLE "BisStage";--> statement-breakpoint
DROP TABLE "CombatRole";--> statement-breakpoint
DROP TABLE "Job";--> statement-breakpoint
DROP TYPE "public"."JobTier";--> statement-breakpoint
ALTER TABLE "MarketConfig" DROP COLUMN "bisEditorRoleId";--> statement-breakpoint

-- 2) Enums de builds ----------------------------------------------------------
CREATE TYPE "public"."BuildSlot" AS ENUM('HEADGEAR_TOP', 'HEADGEAR_MID', 'HEADGEAR_LOW', 'ARMOR', 'WEAPON', 'SHIELD', 'GARMENT', 'FOOTGEAR', 'ACCESSORY_LEFT', 'ACCESSORY_RIGHT');--> statement-breakpoint
CREATE TYPE "public"."BuildTag" AS ENUM('PVP', 'PVE');--> statement-breakpoint

-- 3) Tablas de builds ---------------------------------------------------------
CREATE TABLE "Build" (
	"id" text NOT NULL,
	"ownerId" text NOT NULL,
	"name" text NOT NULL,
	"jobId" integer NOT NULL,
	"tags" "BuildTag"[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BuildEntry" (
	"id" text NOT NULL,
	"buildId" text NOT NULL,
	"slot" "BuildSlot" NOT NULL,
	"itemId" text NOT NULL,
	"refineLevel" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BuildEntryCard" (
	"id" text NOT NULL,
	"entryId" text NOT NULL,
	"slotIndex" integer NOT NULL,
	"cardItemId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BuildEntryOption" (
	"id" text NOT NULL,
	"entryId" text NOT NULL,
	"slotIndex" integer NOT NULL,
	"defId" text NOT NULL,
	"value" integer NOT NULL
);
--> statement-breakpoint

-- 4) Config: tope de builds por usuario ---------------------------------------
ALTER TABLE "MarketConfig" ADD COLUMN "maxBuildsPerUser" integer DEFAULT 5 NOT NULL;--> statement-breakpoint

-- 5) Primary keys (el schema drizzle no las modela —igual que las tablas
--    existentes, cuyas PK vienen del baseline Prisma—, pero los FK las exigen).
ALTER TABLE "Build" ADD CONSTRAINT "Build_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "BuildEntry" ADD CONSTRAINT "BuildEntry_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "BuildEntryOption" ADD CONSTRAINT "BuildEntryOption_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "BuildEntryCard" ADD CONSTRAINT "BuildEntryCard_pkey" PRIMARY KEY ("id");--> statement-breakpoint

-- 6) FKs ----------------------------------------------------------------------
ALTER TABLE "Build" ADD CONSTRAINT "Build_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BuildEntry" ADD CONSTRAINT "BuildEntry_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "public"."Build"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BuildEntry" ADD CONSTRAINT "BuildEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."Item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BuildEntryCard" ADD CONSTRAINT "BuildEntryCard_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."BuildEntry"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BuildEntryCard" ADD CONSTRAINT "BuildEntryCard_cardItemId_fkey" FOREIGN KEY ("cardItemId") REFERENCES "public"."Item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BuildEntryOption" ADD CONSTRAINT "BuildEntryOption_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."BuildEntry"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BuildEntryOption" ADD CONSTRAINT "BuildEntryOption_defId_fkey" FOREIGN KEY ("defId") REFERENCES "public"."ItemOptionDef"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint

-- 7) Índices ------------------------------------------------------------------
CREATE INDEX "Build_ownerId_idx" ON "Build" USING btree ("ownerId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "BuildEntry_buildId_slot_key" ON "BuildEntry" USING btree ("buildId" text_ops,"slot" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "BuildEntryCard_entryId_slotIndex_key" ON "BuildEntryCard" USING btree ("entryId" text_ops,"slotIndex" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "BuildEntryOption_entryId_slotIndex_key" ON "BuildEntryOption" USING btree ("entryId" text_ops,"slotIndex" int4_ops);
