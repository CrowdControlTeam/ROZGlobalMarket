import { pgTable, varchar, timestamp, text, integer, index, foreignKey, uniqueIndex, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createId } from "../lib/id"

export const dealStatus = pgEnum("DealStatus", ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'])
export const equipSlot = pgEnum("EquipSlot", ['HEADGEAR', 'ARMOR', 'SHIELD', 'GARMENT', 'FOOTGEAR', 'ACCESSORY', 'WEAPON'])
export const itemCategory = pgEnum("ItemCategory", ['WEAPON', 'ARMOR', 'CARD', 'ENCHANT', 'COSTUME', 'HEALING', 'USABLE', 'DELAY_CONSUME', 'AMMO', 'ETC', 'PET_EGG', 'PET_ARMOR', 'CASH', 'GET_PORING'])
export const itemOptionGroup = pgEnum("ItemOptionGroup", ['ARMOR', 'GARMENT', 'FOOTGEAR', 'WEAPON_PHYSICAL', 'WEAPON_MAGICAL'])
export const jobTier = pgEnum("JobTier", ['FIRST', 'SECOND', 'THIRD'])
export const listingStatus = pgEnum("ListingStatus", ['ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED'])
export const listingType = pgEnum("ListingType", ['SALE', 'TRADE', 'BUY', 'GIFT'])
export const weaponType = pgEnum("WeaponType", ['DAGGER', 'ONE_HAND_SWORD', 'TWO_HAND_SWORD', 'ONE_HAND_SPEAR', 'TWO_HAND_SPEAR', 'ONE_HAND_AXE', 'TWO_HAND_AXE', 'MACE', 'ROD', 'TWO_HAND_ROD', 'BOW', 'KNUCKLE', 'INSTRUMENT', 'WHIP', 'BOOK', 'KATAR', 'REVOLVER', 'RIFLE', 'GATLING_GUN', 'SHOTGUN', 'GRENADE_LAUNCHER', 'FUUMA_SHURIKEN'])


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
	// updatedAt: Prisma lo rellenaba en cliente (@updatedAt); en la DB no hay
	// default ni trigger, así que Drizzle lo pone al insertar y actualizar.
	// (idem en el resto de tablas con updatedAt.)
}, (table) => [
	index("Listing_price_idx").using("btree", table.price.asc().nullsLast().op("int4_ops")),
	index("Listing_status_createdAt_idx").using("btree", table.status.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [item.id],
			name: "Listing_itemId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
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
	bisEditorRoleId: text(),
});

export const rateLimit = pgTable("RateLimit", {
	key: text().notNull(),
	count: integer().default(0).notNull(),
	windowStart: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const job = pgTable("Job", {
	id: text().notNull().$defaultFn(createId),
	key: text().notNull(),
	label: text().notNull(),
	tier: jobTier().default('FIRST').notNull(),
	parentJobId: text(),
	order: integer().default(0).notNull(),
}, (table) => [
	uniqueIndex("Job_key_key").using("btree", table.key.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.parentJobId],
			foreignColumns: [table.id],
			name: "Job_parentJobId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const bisStage = pgTable("BisStage", {
	id: text().notNull().$defaultFn(createId),
	key: text().notNull(),
	label: text().notNull(),
	order: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("BisStage_key_key").using("btree", table.key.asc().nullsLast().op("text_ops")),
]);

export const bisEntryOption = pgTable("BisEntryOption", {
	id: text().notNull().$defaultFn(createId),
	entryId: text().notNull(),
	slotIndex: integer().notNull(),
	defId: text().notNull(),
	minValue: integer(),
}, (table) => [
	uniqueIndex("BisEntryOption_entryId_slotIndex_key").using("btree", table.entryId.asc().nullsLast().op("int4_ops"), table.slotIndex.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.entryId],
			foreignColumns: [bisEntry.id],
			name: "BisEntryOption_entryId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.defId],
			foreignColumns: [itemOptionDef.id],
			name: "BisEntryOption_defId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const bisEntryToCombatRole = pgTable("_BisEntryToCombatRole", {
	a: text("A").notNull(),
	b: text("B").notNull(),
}, (table) => [
	index().using("btree", table.b.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.a],
			foreignColumns: [bisEntry.id],
			name: "_BisEntryToCombatRole_A_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.b],
			foreignColumns: [combatRole.id],
			name: "_BisEntryToCombatRole_B_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const combatRole = pgTable("CombatRole", {
	id: text().notNull().$defaultFn(createId),
	key: text().notNull(),
	label: text().notNull(),
	order: integer().default(0).notNull(),
}, (table) => [
	uniqueIndex("CombatRole_key_key").using("btree", table.key.asc().nullsLast().op("text_ops")),
]);

export const bisEntryToJob = pgTable("_BisEntryToJob", {
	a: text("A").notNull(),
	b: text("B").notNull(),
}, (table) => [
	index().using("btree", table.b.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.a],
			foreignColumns: [bisEntry.id],
			name: "_BisEntryToJob_A_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.b],
			foreignColumns: [job.id],
			name: "_BisEntryToJob_B_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

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
	foreignKey({
			columns: [table.offeredItemId],
			foreignColumns: [item.id],
			name: "Deal_offeredItemId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
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

export const item = pgTable("Item", {
	id: text().notNull(),
	name: text().notNull(),
	category: itemCategory().notNull(),
	slot: equipSlot(),
	iconUrl: text().notNull(),
	importedAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
	weaponType: weaponType(),
	armorLevel: integer(),
	attack: integer(),
	cardSlot: text(),
	categorySource: text(),
	classNum: integer(),
	cooldown: text(),
	costume: boolean().default(false).notNull(),
	defense: integer(),
	effectId: integer(),
	element: text(),
	itemType: text(),
	jobs: text(),
	petTarget: text(),
	position: text(),
	requiredLevel: integer(),
	restrictions: jsonb(),
	slotCount: integer().default(0).notNull(),
	subType: text(),
	tradeable: boolean().default(true).notNull(),
	unidentifiedName: text(),
	weaponLevel: integer(),
	weight: integer(),
	description: text().array().default([]).notNull(),
}, (table) => [
	index("Item_category_slot_idx").using("btree", table.category.asc().nullsLast().op("enum_ops"), table.slot.asc().nullsLast().op("enum_ops")),
	index("Item_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("Item_tradeable_idx").using("btree", table.tradeable.asc().nullsLast().op("bool_ops")),
]);

export const bisEntry = pgTable("BisEntry", {
	id: text().notNull().$defaultFn(createId),
	stageId: text().notNull(),
	slot: equipSlot().notNull(),
	itemId: text(),
	refineLevel: integer(),
	note: text(),
	position: integer().default(0).notNull(),
	createdById: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
	weaponType: weaponType(),
}, (table) => [
	index("BisEntry_stageId_slot_position_idx").using("btree", table.stageId.asc().nullsLast().op("int4_ops"), table.slot.asc().nullsLast().op("int4_ops"), table.position.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.stageId],
			foreignColumns: [bisStage.id],
			name: "BisEntry_stageId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [item.id],
			name: "BisEntry_itemId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [user.id],
			name: "BisEntry_createdById_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

// Compatibilidad con los enums de Prisma: la app los usa como VALOR
// (p. ej. `EquipSlot.WEAPON`) además de como tipo. Drizzle solo expone
// `<enum>.enumValues` (array), así que reconstruimos el objeto { CLAVE: "CLAVE" }
// que generaba Prisma. Cada enum queda declarado a la vez como const (valor) y
// como type (unión), igual que en `@prisma/client`.
function enumObject<const T extends readonly string[]>(values: T): { [K in T[number]]: K } {
  return Object.fromEntries(values.map((v) => [v, v])) as { [K in T[number]]: K };
}

export const ItemCategory = enumObject(itemCategory.enumValues);
export type ItemCategory = (typeof itemCategory.enumValues)[number];
export const EquipSlot = enumObject(equipSlot.enumValues);
export type EquipSlot = (typeof equipSlot.enumValues)[number];
export const WeaponType = enumObject(weaponType.enumValues);
export type WeaponType = (typeof weaponType.enumValues)[number];
export const ListingType = enumObject(listingType.enumValues);
export type ListingType = (typeof listingType.enumValues)[number];
export const ListingStatus = enumObject(listingStatus.enumValues);
export type ListingStatus = (typeof listingStatus.enumValues)[number];
export const DealStatus = enumObject(dealStatus.enumValues);
export type DealStatus = (typeof dealStatus.enumValues)[number];
export const ItemOptionGroup = enumObject(itemOptionGroup.enumValues);
export type ItemOptionGroup = (typeof itemOptionGroup.enumValues)[number];
export const JobTier = enumObject(jobTier.enumValues);
export type JobTier = (typeof jobTier.enumValues)[number];

// Tipos de fila de los modelos (equivalen a los tipos que generaba Prisma).
export type Item = typeof item.$inferSelect;
export type ItemOptionDef = typeof itemOptionDef.$inferSelect;
export type Listing = typeof listing.$inferSelect;
export type ListingOption = typeof listingOption.$inferSelect;
export type Deal = typeof deal.$inferSelect;
export type User = typeof user.$inferSelect;
export type BisEntry = typeof bisEntry.$inferSelect;
export type SavedSearch = typeof savedSearch.$inferSelect;
export type MarketConfig = typeof marketConfig.$inferSelect;
