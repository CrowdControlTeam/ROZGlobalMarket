"use server";

import { requireSession } from "@/lib/guard";
import { getListings, type MarketFilters } from "@/lib/market";

export async function loadMoreListings(filters: MarketFilters) {
  await requireSession();
  return getListings(filters);
}
