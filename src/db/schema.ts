import { pgTable, varchar, timestamp, text, integer, index, foreignKey, uniqueIndex, boolean, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createId } from "../lib/id"
import {
  BUILD_SLOT_VALUES,
  BUILD_TAG_VALUES,
  DEAL_STATUS_VALUES,
  EQUIP_SLOT_VALUES,
  ITEM_CATEGORY_VALUES,
  ITEM_OPTION_GROUP_VALUES,
  LISTING_STATUS_VALUES,
  LISTING_TYPE_VALUES,
  WEAPON_TYPE_VALUES,
} from "./enums"

export const buildSlot = pgEnum("BuildSlot", BUILD_SLOT_VALUES)
export const buildTag = pgEnum("BuildTag", BUILD_TAG_VALUES)
export const dealStatus = pgEnum("DealStatus", DEAL_STATUS_VALUES)
export const equipSlot = pgEnum("EquipSlot", EQUIP_SLOT_VALUES)
export const itemCategory = pgEnum("ItemCategory", ITEM_CATEGORY_VALUES)
export const itemOptionGroup = pgEnum("ItemOptionGroup", ITEM_OPTION_GROUP_VALUES)
export const listingStatus = pgEnum("ListingStatus", LISTING_STATUS_VALUES)
export const listingType = pgEnum("ListingType", LISTING_TYPE_VALUES)
export const weaponType = pgEnum("WeaponType", WEAPON_TYPE_VALUES)


export const prismaMigrations = pgTable("_prisma_migrations", {
	id: varchar({ length: 36 }).notNull(),
	checksum: varchar({ length: 64 }).notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'date' }),
	migrationName: varchar("migration_name", { length: 255 }).notNull(),
	logs: text(),
	rolledBackAt: timestamp("rolled_back_at", { withTimezone: true, mode: 'date' }),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	appliedStepsCount: integer("applied_steps_count").default(0).notNull(),
});

export const user = pgTable("User", {
	id: text().notNull(),
	username: text().notNull(),
	avatarUrl: text(),
	guildRoles: text().array().default([]).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const listing = pgTable("Listing", {
	id: text().notNull().$defaultFn(createId),
	posterId: text().notNull(),
	itemId: text().notNull(),
	quantity: integer(),
	price: integer(),
	status: listingStatus().default('ACTIVE').notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
	refineLevel: integer().default(0).notNull(),
	type: listingType().default('SALE').notNull(),
	notes: text(),
	// When the listing auto-expires. Set at creation to now + MarketConfig
	// .listingExpirationDays. Nullable = never expires (safety default for any
	// row without a value; the cron only touches rows with expiresAt <= now()).
	expiresAt: timestamp({ precision: 3, mode: 'date' }),
	// updatedAt: Prisma filled this client-side (@updatedAt); the DB has no default
	// or trigger, so Drizzle sets it on insert and update (same for the other tables
	// with updatedAt).
	// Denormalized item fields: the market grid filters, sorts and keyset-paginates
	// by these in SQL. Items live in memory (see item-store), not the DB, so these
	// are copied onto the listing at write time and refreshed by the item import if
	// the item changes. Everything else about the item (icon, full record) is
	// resolved from memory by itemId — these columns are ONLY what the grid queries.
	// Defaults exist so ADD COLUMN is clean on existing rows; the app always sets
	// real values on write (see createListing/updateListing).
	itemName: text().default('').notNull(),
	itemCategory: itemCategory().default('ETC').notNull(),
	itemSlot: equipSlot(),
	itemWeaponType: weaponType(),
	itemSlotCount: integer().default(0).notNull(),
}, (table) => [
	index("Listing_price_idx").using("btree", table.price.asc().nullsLast().op("int4_ops")),
	// Orden por nombre del grid (name_asc/desc) con paginación keyset por (itemName, id).
	index("Listing_itemName_idx").using("btree", table.itemName.asc().nullsLast().op("text_ops")),
	index("Listing_status_createdAt_idx").using("btree", table.status.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("timestamp_ops")),
	// Sirve tanto al filtro del mercado (status='ACTIVE' AND expiresAt > now())
	// como al barrido del cron (status='ACTIVE' AND expiresAt <= now()).
	index("Listing_status_expiresAt_idx").using("btree", table.status.asc().nullsLast().op("enum_ops"), table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	// itemId es texto plano sin FK: los items viven en memoria (item-store), no en
	// la BD. La integridad se gestiona en la app (ver import:items).
	foreignKey({
			columns: [table.posterId],
			foreignColumns: [user.id],
			name: "Listing_posterId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const listingOption = pgTable("ListingOption", {
	id: text().notNull().$defaultFn(createId),
	listingId: text().notNull(),
	slotIndex: integer().notNull(),
	defId: text().notNull(),
	value: integer().notNull(),
}, (table) => [
	uniqueIndex("ListingOption_listingId_slotIndex_key").using("btree", table.listingId.asc().nullsLast().op("int4_ops"), table.slotIndex.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.listingId],
			foreignColumns: [listing.id],
			name: "ListingOption_listingId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.defId],
			foreignColumns: [itemOptionDef.id],
			name: "ListingOption_defId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

// Cartas insertadas en una publicación (una por ranura, hasta Item.slotCount).
// Espejo de BuildEntryCard: la carta debe encajar en el slot de equipo del item
// (ver cardFitsEquipSlot). onDelete restrict en la carta = no se borra un item
// que sea carta usada en una publicación.
export const listingCard = pgTable("ListingCard", {
	id: text().notNull().$defaultFn(createId),
	listingId: text().notNull(),
	slotIndex: integer().notNull(),
	cardItemId: text().notNull(),
}, (table) => [
	uniqueIndex("ListingCard_listingId_slotIndex_key").using("btree", table.listingId.asc().nullsLast().op("text_ops"), table.slotIndex.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.listingId],
			foreignColumns: [listing.id],
			name: "ListingCard_listingId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	// cardItemId sin FK (item en memoria).
]);

export const itemOptionDef = pgTable("ItemOptionDef", {
	id: text().notNull().$defaultFn(createId),
	group: itemOptionGroup().notNull(),
	slotIndex: integer().notNull(),
	statCode: text().notNull(),
	label: text().notNull(),
	minValue: integer().notNull(),
	maxValue: integer().notNull(),
}, (table) => [
	index("ItemOptionDef_group_slotIndex_idx").using("btree", table.group.asc().nullsLast().op("enum_ops"), table.slotIndex.asc().nullsLast().op("int4_ops")),
	uniqueIndex("ItemOptionDef_group_slotIndex_statCode_key").using("btree", table.group.asc().nullsLast().op("text_ops"), table.slotIndex.asc().nullsLast().op("text_ops"), table.statCode.asc().nullsLast().op("enum_ops")),
]);

export const magicalWeaponType = pgTable("MagicalWeaponType", {
	type: weaponType().notNull(),
});

export const marketConfig = pgTable("MarketConfig", {
	id: integer().default(1).notNull(),
	maxRefineLevel: integer().default(10).notNull(),
	imageRecognitionEnabled: boolean().default(false).notNull(),
	maintenanceModeEnabled: boolean().default(false).notNull(),
	webhookEnabled: boolean().default(false).notNull(),
	webhookUrl: text(),
	optionsEnabled: boolean().default(true).notNull(),
	adminRoleIds: text().array().default([]).notNull(),
	geminiModel: text().default('gemini-flash-latest').notNull(),
	dmNotificationsEnabled: boolean().default(true).notNull(),
	siteName: text(),
	homeImageUrl: text(),
	logoUrl: text(),
	accessRoleId: text(),
	// Días que una publicación permanece activa antes de caducar (cron → EXPIRED).
	listingExpirationDays: integer().default(7).notNull(),
	// Máximo de builds que puede tener cada usuario.
	maxBuildsPerUser: integer().default(5).notNull(),
});

export const rateLimit = pgTable("RateLimit", {
	key: text().notNull(),
	count: integer().default(0).notNull(),
	windowStart: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const deal = pgTable("Deal", {
	id: text().notNull().$defaultFn(createId),
	listingId: text().notNull(),
	userId: text().notNull(),
	quantity: integer().notNull(),
	status: dealStatus().default('PENDING').notNull(),
	unitPrice: integer(),
	offeredItemId: text(),
	offeredRefine: integer(),
	zenyOffered: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
	offeredQuantity: integer(),
}, (table) => [
	index("Deal_listingId_status_idx").using("btree", table.listingId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("Deal_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.listingId],
			foreignColumns: [listing.id],
			name: "Deal_listingId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Deal_userId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	// offeredItemId sin FK (item en memoria; el import lo pone a null si el item desaparece).
]);

export const savedSearch = pgTable("SavedSearch", {
	id: text().notNull().$defaultFn(createId),
	userId: text().notNull(),
	name: text().notNull(),
	filters: text().notNull(),
	sortOrder: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
}, (table) => [
	index("SavedSearch_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "SavedSearch_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

// La tabla Item fue eliminada: los items son datos estáticos de referencia que
// viven en memoria (src/data/item-catalog.json, ver src/lib/item-store.ts). Las
// columnas itemId/cardItemId/offeredItemId son texto plano sin FK.

// Build de un usuario: nombre, clase (jobId = id del job en skill-planner.json,
// misma fuente que el planner; sin FK a una tabla), etiquetas (≥1 PvP/PvE) y
// notas. Las piezas van en BuildEntry (una por slot ocupado).
export const build = pgTable("Build", {
	id: text().notNull().$defaultFn(createId),
	ownerId: text().notNull(),
	name: text().notNull(),
	jobId: integer().notNull(),
	tags: buildTag().array().default([]).notNull(),
	notes: text(),
	// Código exportado del skill planner (base64url; ver encodeBuild/decodeBuild).
	// Opcional: null = la build no lleva plan de skills. Su jobId codificado debe
	// coincidir con `jobId` (se valida al guardar).
	skillCode: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
}, (table) => [
	index("Build_ownerId_idx").using("btree", table.ownerId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [user.id],
			name: "Build_ownerId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

// Una pieza de la build en un slot concreto (item + refino). Sus options
// aleatorias van en BuildEntryOption y sus cartas en BuildEntryCard.
export const buildEntry = pgTable("BuildEntry", {
	id: text().notNull().$defaultFn(createId),
	buildId: text().notNull(),
	slot: buildSlot().notNull(),
	itemId: text().notNull(),
	refineLevel: integer().default(0).notNull(),
}, (table) => [
	uniqueIndex("BuildEntry_buildId_slot_key").using("btree", table.buildId.asc().nullsLast().op("text_ops"), table.slot.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.buildId],
			foreignColumns: [build.id],
			name: "BuildEntry_buildId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	// itemId sin FK (item en memoria).
]);

// Options aleatorias de una pieza de la build (mismo patrón que ListingOption).
export const buildEntryOption = pgTable("BuildEntryOption", {
	id: text().notNull().$defaultFn(createId),
	entryId: text().notNull(),
	slotIndex: integer().notNull(),
	defId: text().notNull(),
	value: integer().notNull(),
}, (table) => [
	uniqueIndex("BuildEntryOption_entryId_slotIndex_key").using("btree", table.entryId.asc().nullsLast().op("text_ops"), table.slotIndex.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.entryId],
			foreignColumns: [buildEntry.id],
			name: "BuildEntryOption_entryId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.defId],
			foreignColumns: [itemOptionDef.id],
			name: "BuildEntryOption_defId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

// Cartas de una pieza de la build, una por ranura (hasta Item.slotCount). El
// cardItemId apunta a un Item de categoría CARD.
export const buildEntryCard = pgTable("BuildEntryCard", {
	id: text().notNull().$defaultFn(createId),
	entryId: text().notNull(),
	slotIndex: integer().notNull(),
	cardItemId: text().notNull(),
}, (table) => [
	uniqueIndex("BuildEntryCard_entryId_slotIndex_key").using("btree", table.entryId.asc().nullsLast().op("text_ops"), table.slotIndex.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.entryId],
			foreignColumns: [buildEntry.id],
			name: "BuildEntryCard_entryId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	// cardItemId sin FK (item en memoria).
]);

// Enums (value + type): they live in ./enums (client-safe) and are re-exported
// here (each name is both a value and a type) so server code can import them
// alongside the tables.
export {
  ItemCategory,
  EquipSlot,
  WeaponType,
  ListingType,
  ListingStatus,
  DealStatus,
  ItemOptionGroup,
  BuildSlot,
  BuildTag,
} from "./enums";

// Model row types (equivalent to the types Prisma used to generate).
export type ItemOptionDef = typeof itemOptionDef.$inferSelect;
export type Listing = typeof listing.$inferSelect;
export type ListingOption = typeof listingOption.$inferSelect;
export type ListingCard = typeof listingCard.$inferSelect;
export type Deal = typeof deal.$inferSelect;
export type User = typeof user.$inferSelect;
export type Build = typeof build.$inferSelect;
export type BuildEntry = typeof buildEntry.$inferSelect;
export type BuildEntryOption = typeof buildEntryOption.$inferSelect;
export type BuildEntryCard = typeof buildEntryCard.$inferSelect;
export type SavedSearch = typeof savedSearch.$inferSelect;
export type MarketConfig = typeof marketConfig.$inferSelect;
