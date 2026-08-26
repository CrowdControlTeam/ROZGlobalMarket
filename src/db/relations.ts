import { relations } from "drizzle-orm/relations";
import { item, listing, user, listingOption, itemOptionDef, job, bisEntry, bisEntryOption, bisEntryToCombatRole, combatRole, bisEntryToJob, deal, savedSearch, bisStage } from "./schema";

export const listingRelations = relations(listing, ({one, many}) => ({
	item: one(item, {
		fields: [listing.itemId],
		references: [item.id]
	}),
	// Nombres alineados con Prisma (poster/options) para no tocar el código
	// consumidor.
	poster: one(user, {
		fields: [listing.posterId],
		references: [user.id]
	}),
	options: many(listingOption),
	deals: many(deal),
}));

export const itemRelations = relations(item, ({many}) => ({
	listings: many(listing),
	deals: many(deal),
	bisEntries: many(bisEntry),
}));

export const userRelations = relations(user, ({many}) => ({
	listings: many(listing),
	deals: many(deal),
	savedSearches: many(savedSearch),
	bisEntries: many(bisEntry),
}));

export const listingOptionRelations = relations(listingOption, ({one}) => ({
	listing: one(listing, {
		fields: [listingOption.listingId],
		references: [listing.id]
	}),
	// `def` como en Prisma (ListingOption.def).
	def: one(itemOptionDef, {
		fields: [listingOption.defId],
		references: [itemOptionDef.id]
	}),
}));

export const itemOptionDefRelations = relations(itemOptionDef, ({many}) => ({
	listingOptions: many(listingOption),
	bisEntryOptions: many(bisEntryOption),
}));

export const jobRelations = relations(job, ({one, many}) => ({
	job: one(job, {
		fields: [job.parentJobId],
		references: [job.id],
		relationName: "job_parentJobId_job_id"
	}),
	jobs: many(job, {
		relationName: "job_parentJobId_job_id"
	}),
	bisEntryToJobs: many(bisEntryToJob),
}));

export const bisEntryOptionRelations = relations(bisEntryOption, ({one}) => ({
	bisEntry: one(bisEntry, {
		fields: [bisEntryOption.entryId],
		references: [bisEntry.id]
	}),
	// `def` como en Prisma (BisEntryOption.def).
	def: one(itemOptionDef, {
		fields: [bisEntryOption.defId],
		references: [itemOptionDef.id]
	}),
}));

export const bisEntryRelations = relations(bisEntry, ({one, many}) => ({
	bisEntryOptions: many(bisEntryOption),
	bisEntryToCombatRoles: many(bisEntryToCombatRole),
	bisEntryToJobs: many(bisEntryToJob),
	bisStage: one(bisStage, {
		fields: [bisEntry.stageId],
		references: [bisStage.id]
	}),
	item: one(item, {
		fields: [bisEntry.itemId],
		references: [item.id]
	}),
	user: one(user, {
		fields: [bisEntry.createdById],
		references: [user.id]
	}),
}));

export const bisEntryToCombatRoleRelations = relations(bisEntryToCombatRole, ({one}) => ({
	bisEntry: one(bisEntry, {
		fields: [bisEntryToCombatRole.a],
		references: [bisEntry.id]
	}),
	combatRole: one(combatRole, {
		fields: [bisEntryToCombatRole.b],
		references: [combatRole.id]
	}),
}));

export const combatRoleRelations = relations(combatRole, ({many}) => ({
	bisEntryToCombatRoles: many(bisEntryToCombatRole),
}));

export const bisEntryToJobRelations = relations(bisEntryToJob, ({one}) => ({
	bisEntry: one(bisEntry, {
		fields: [bisEntryToJob.a],
		references: [bisEntry.id]
	}),
	job: one(job, {
		fields: [bisEntryToJob.b],
		references: [job.id]
	}),
}));

export const dealRelations = relations(deal, ({one}) => ({
	listing: one(listing, {
		fields: [deal.listingId],
		references: [listing.id]
	}),
	user: one(user, {
		fields: [deal.userId],
		references: [user.id]
	}),
	// Item de contraoferta en un TRADE (Deal.offeredItemId). Nombre alineado con
	// el `offeredItem` que usaba Prisma.
	offeredItem: one(item, {
		fields: [deal.offeredItemId],
		references: [item.id]
	}),
}));

export const savedSearchRelations = relations(savedSearch, ({one}) => ({
	user: one(user, {
		fields: [savedSearch.userId],
		references: [user.id]
	}),
}));

export const bisStageRelations = relations(bisStage, ({many}) => ({
	bisEntries: many(bisEntry),
}));