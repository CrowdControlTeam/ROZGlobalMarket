"use server";

import { ListingType, ListingStatus, DealStatus } from "@prisma/client";
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

// Todo el cálculo se hace en JS a partir de filas planas (Listing + Deal) en vez
// de groupBy/aggregate encadenados: cruzar los tratos con el poster/item del
// Listing no es directo con groupBy, y el volumen de un mercado de guild
// (cientos de filas) hace que reducir en memoria sea sencillo y barato.
//
// Deal sustituye a las tablas Purchase/TradeOffer/Gift (ver el rediseño): un
// trato ACCEPTED es una compra/venta/intercambio/regalo ya cerrado. El sentido
// del dinero depende del tipo de listing: en SALE el vendedor es el poster y el
// comprador la contraparte; en BUY, al revés; en TRADE el "dinero" es el zeny
// de compensación; GIFT no mueve zeny.
export async function getMarketStats(period: StatsPeriod = "30d") {
  await requireAdmin();
  const since = windowStartFor(period);

  const [listings, deals, totalUsers] = await Promise.all([
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
    // updatedAt (no createdAt): lo que interesa de un trato es cuándo se resolvió
    // (aceptado/rechazado/cancelado), no solo cuándo se creó.
    prisma.deal.findMany({
      where: { updatedAt: { gte: since } },
      select: {
        status: true,
        quantity: true,
        unitPrice: true,
        zenyOffered: true,
        userId: true,
        user: { select: { username: true } },
        listing: {
          select: {
            type: true,
            posterId: true,
            itemId: true,
            poster: { select: { username: true } },
            item: { select: { name: true } },
          },
        },
      },
    }),
    prisma.user.count(),
  ]);

  // --- Totales ---
  const listingsByTypeStatus: Record<ListingType, Record<ListingStatus, number>> = {
    SALE: { ACTIVE: 0, COMPLETED: 0, SOLD: 0, CANCELLED: 0, EXPIRED: 0 },
    BUY: { ACTIVE: 0, COMPLETED: 0, SOLD: 0, CANCELLED: 0, EXPIRED: 0 },
    TRADE: { ACTIVE: 0, COMPLETED: 0, SOLD: 0, CANCELLED: 0, EXPIRED: 0 },
    GIFT: { ACTIVE: 0, COMPLETED: 0, SOLD: 0, CANCELLED: 0, EXPIRED: 0 },
  };
  const posterIds = new Set<string>();
  for (const l of listings) {
    listingsByTypeStatus[l.type][l.status]++;
    posterIds.add(l.posterId);
  }

  // Estados de las ofertas de intercambio (ahora Deal sobre listings TRADE).
  const tradeOffersByStatus: Record<DealStatus, number> = {
    PENDING: 0,
    ACCEPTED: 0,
    REJECTED: 0,
    CANCELLED: 0,
  };
  for (const d of deals) {
    if (d.listing.type === "TRADE") tradeOffersByStatus[d.status]++;
  }

  // --- Rankings ---
  const topPostersMap = new Map<string, UserTotal>();
  const topListedItemsMap = new Map<string, ItemTotal>();
  for (const l of listings) {
    addTotal(topPostersMap, l.posterId, l.poster.username, 1);
    addItemTotal(topListedItemsMap, l.itemId, l.item.name, 1);
  }

  // Dinero movido + ganadores/gastadores + items más comerciados, a partir de
  // los tratos ACEPTADOS.
  const earnersMap = new Map<string, UserTotal>();
  const spendersMap = new Map<string, UserTotal>();
  const topPurchasedItemsMap = new Map<string, ItemTotal>();
  let zenyMoved = 0;
  let giftsSent = 0;

  for (const d of deals) {
    if (d.status !== "ACCEPTED") continue;
    const l = d.listing;

    if (l.type === "GIFT") {
      giftsSent += 1;
      continue;
    }

    if (l.type === "TRADE") {
      if (d.zenyOffered > 0) {
        zenyMoved += d.zenyOffered;
        addTotal(earnersMap, l.posterId, l.poster.username, d.zenyOffered);
        addTotal(spendersMap, d.userId, d.user.username, d.zenyOffered);
      }
      continue;
    }

    // SALE / BUY: hay precio unitario. En SALE vende el poster; en BUY, la
    // contraparte (el poster es quien compra).
    const amount = d.quantity * (d.unitPrice ?? 0);
    if (amount <= 0) continue;
    zenyMoved += amount;
    const sellerId = l.type === "SALE" ? l.posterId : d.userId;
    const sellerName = l.type === "SALE" ? l.poster.username : d.user.username;
    const buyerId = l.type === "SALE" ? d.userId : l.posterId;
    const buyerName = l.type === "SALE" ? d.user.username : l.poster.username;
    addTotal(earnersMap, sellerId, sellerName, amount);
    addTotal(spendersMap, buyerId, buyerName, amount);
    addItemTotal(topPurchasedItemsMap, l.itemId, l.item.name, d.quantity);
  }

  return {
    period,
    windowDays: 30,
    totals: {
      listingsByTypeStatus,
      zenyMoved,
      tradeOffersByStatus,
      giftsSent,
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
