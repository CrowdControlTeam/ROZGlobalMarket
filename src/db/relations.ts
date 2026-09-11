import { relations } from "drizzle-orm/relations";
import {
  listing,
  user,
  listingOption,
  listingCard,
  itemOptionDef,
  deal,
  savedSearch,
  build,
  buildEntry,
  buildEntryOption,
  buildEntryCard,
} from "./schema";

// Los items no viven en la BD (ver src/lib/item-store): itemId/cardItemId/
// offeredItemId son texto plano sin FK ni relación; se resuelven en memoria.

export const listingRelations = relations(listing, ({ one, many }) => ({
  // Names aligned with Prisma (poster/options) to avoid touching consumer code.
  poster: one(user, {
    fields: [listing.posterId],
    references: [user.id],
  }),
  options: many(listingOption),
  cards: many(listingCard),
  deals: many(deal),
}));

export const userRelations = relations(user, ({ many }) => ({
  listings: many(listing),
  deals: many(deal),
  savedSearches: many(savedSearch),
  builds: many(build),
}));

export const listingOptionRelations = relations(listingOption, ({ one }) => ({
  listing: one(listing, {
    fields: [listingOption.listingId],
    references: [listing.id],
  }),
  // `def` as in Prisma (ListingOption.def).
  def: one(itemOptionDef, {
    fields: [listingOption.defId],
    references: [itemOptionDef.id],
  }),
}));

export const listingCardRelations = relations(listingCard, ({ one }) => ({
  listing: one(listing, {
    fields: [listingCard.listingId],
    references: [listing.id],
  }),
}));

export const itemOptionDefRelations = relations(itemOptionDef, ({ many }) => ({
  listingOptions: many(listingOption),
}));

export const dealRelations = relations(deal, ({ one }) => ({
  listing: one(listing, {
    fields: [deal.listingId],
    references: [listing.id],
  }),
  user: one(user, {
    fields: [deal.userId],
    references: [user.id],
  }),
}));

export const savedSearchRelations = relations(savedSearch, ({ one }) => ({
  user: one(user, {
    fields: [savedSearch.userId],
    references: [user.id],
  }),
}));

// ── Builds ──────────────────────────────────────────────────────────────────
export const buildRelations = relations(build, ({ one, many }) => ({
  owner: one(user, {
    fields: [build.ownerId],
    references: [user.id],
  }),
  entries: many(buildEntry),
}));

export const buildEntryRelations = relations(buildEntry, ({ one, many }) => ({
  build: one(build, {
    fields: [buildEntry.buildId],
    references: [build.id],
  }),
  options: many(buildEntryOption),
  cards: many(buildEntryCard),
}));

export const buildEntryOptionRelations = relations(buildEntryOption, ({ one }) => ({
  entry: one(buildEntry, {
    fields: [buildEntryOption.entryId],
    references: [buildEntry.id],
  }),
  def: one(itemOptionDef, {
    fields: [buildEntryOption.defId],
    references: [itemOptionDef.id],
  }),
}));

export const buildEntryCardRelations = relations(buildEntryCard, ({ one }) => ({
  entry: one(buildEntry, {
    fields: [buildEntryCard.entryId],
    references: [buildEntry.id],
  }),
}));
