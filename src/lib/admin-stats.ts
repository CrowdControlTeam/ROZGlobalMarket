"use server";

import { ListingType, ListingStatus, TradeOfferStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import type { StatsPeriod } from "@/lib/admin-stats-constants";

// Un único caso hoy (period siempre es "30d") — cuando haya más valores en
// STATS_PERIOD_VALUES (admin-stats-constants.ts), este switch es el único
// sitio que hay que tocar.
function windowStartFor(period: StatsPeriod): Date {
  const days = { "30d": 30 }[period];
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

type UserTotal = { userId: string; username: string; total: number };
type ItemTotal = { itemId: string; itemName: string; total: number };

function addTotal(map: Map<string, UserTotal>, userId: string, username: string, amount: number) {
  const existing = map.get(userId);
  if (existing) existing.total += amount;
  else map.set(userId, { userId, username, total: amount });
}

function addItemTotal(map: Map<string, ItemTotal>, itemId: string, itemName: string, amount: number) {
  const existing = map.get(itemId);
  if (existing) existing.total += amount;
  else map.set(itemId, { itemId, itemName, total: amount });
}

function topN<T extends { total: number }>(map: Map<string, T>, n: number): T[] {
  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

// Todo el cálculo se hace en JS a partir de filas planas en vez de
// groupBy/aggregate encadenados de Prisma: cruzar Purchase/TradeOffer con
// el poster o el item del Listing asociado no es directo con groupBy, y el
// volumen de un mercado de guild (cientos de filas, no millones) hace que
// reducir en memoria sea sencillo y perfectamente barato.
export async function getMarketStats(period: StatsPeriod = "30d") {
  await requireAdmin();
  const since = windowStartFor(period);

  const [listings, purchases, tradeOffers, gifts, totalUsers] = await Promise.all([
    prisma.listing.findMany({
      where: { createdAt: { gte: since } },
      select: {
        type: true,
        status: true,
        posterId: true,
        itemId: true,
        poster: { select: { username: true } },
        item: { select: { name: true } },
      },
    }),
    prisma.purchase.findMany({
      where: { createdAt: { gte: since } },
      select: {
        quantity: true,
        unitPrice: true,
        buyerId: true,
        buyer: { select: { username: true } },
        listing: {
          select: {
            posterId: true,
            itemId: true,
            poster: { select: { username: true } },
            item: { select: { name: true } },
          },
        },
      },
    }),
    // updatedAt (no createdAt): lo que interesa de una oferta es cuándo
    // cambió de estado (aceptada/rechazada/cancelada), no solo cuándo se
    // creó — una oferta creada hace 40 días pero aceptada hace 3 sí cuenta
    // como actividad reciente.
    prisma.tradeOffer.findMany({
      where: { updatedAt: { gte: since } },
      select: {
        status: true,
        zenyOffered: true,
        offererId: true,
        offerer: { select: { username: true } },
        listing: { select: { posterId: true, poster: { select: { username: true } } } },
      },
    }),
    prisma.gift.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count(),
  ]);

  // --- Totales ---
  const listingsByTypeStatus: Record<ListingType, Record<ListingStatus, number>> = {
    SALE: { ACTIVE: 0, SOLD: 0, CANCELLED: 0, EXPIRED: 0 },
    BUY: { ACTIVE: 0, SOLD: 0, CANCELLED: 0, EXPIRED: 0 },
    TRADE: { ACTIVE: 0, SOLD: 0, CANCELLED: 0, EXPIRED: 0 },
  };
  const posterIds = new Set<string>();
  for (const l of listings) {
    listingsByTypeStatus[l.type][l.status]++;
    posterIds.add(l.posterId);
  }

  const tradeOffersByStatus: Record<TradeOfferStatus, number> = {
    PENDING: 0,
    ACCEPTED: 0,
    REJECTED: 0,
    CANCELLED: 0,
  };
  for (const o of tradeOffers) tradeOffersByStatus[o.status]++;

  const purchaseZeny = purchases.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
  const acceptedTradeZeny = tradeOffers
    .filter((o) => o.status === "ACCEPTED")
    .reduce((sum, o) => sum + o.zenyOffered, 0);

  // --- Rankings ---
  const topPostersMap = new Map<string, UserTotal>();
  const topListedItemsMap = new Map<string, ItemTotal>();
  for (const l of listings) {
    addTotal(topPostersMap, l.posterId, l.poster.username, 1);
    addItemTotal(topListedItemsMap, l.itemId, l.item.name, 1);
  }

  const earnersMap = new Map<string, UserTotal>();
  const spendersMap = new Map<string, UserTotal>();
  const topPurchasedItemsMap = new Map<string, ItemTotal>();
  for (const p of purchases) {
    const amount = p.quantity * p.unitPrice;
    addTotal(earnersMap, p.listing.posterId, p.listing.poster.username, amount);
    addTotal(spendersMap, p.buyerId, p.buyer.username, amount);
    addItemTotal(topPurchasedItemsMap, p.listing.itemId, p.listing.item.name, p.quantity);
  }
  for (const o of tradeOffers) {
    if (o.status !== "ACCEPTED" || o.zenyOffered <= 0) continue;
    addTotal(earnersMap, o.listing.posterId, o.listing.poster.username, o.zenyOffered);
    addTotal(spendersMap, o.offererId, o.offerer.username, o.zenyOffered);
  }

  return {
    period,
    windowDays: 30,
    totals: {
      listingsByTypeStatus,
      zenyMoved: purchaseZeny + acceptedTradeZeny,
      tradeOffersByStatus,
      giftsSent: gifts,
      postersCount: posterIds.size,
      totalUsers,
    },
    rankings: {
      topPosters: topN(topPostersMap, 10),
      topEarners: topN(earnersMap, 10),
      topSpenders: topN(spendersMap, 10),
      topListedItems: topN(topListedItemsMap, 10),
      topPurchasedItems: topN(topPurchasedItemsMap, 10),
    },
  };
}
