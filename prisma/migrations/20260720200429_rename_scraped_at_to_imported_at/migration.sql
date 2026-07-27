-- Rename Item.scrapedAt to Item.importedAt (data-preserving rename, no scraper-specific naming)
ALTER TABLE "Item" RENAME COLUMN "scrapedAt" TO "importedAt";
