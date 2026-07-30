"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { listingCardState } from "@/lib/listing-card";
import { loadMarketConfig } from "@/lib/market-config";
import { sendDirectMessage } from "@/lib/discord-bot";
import { getAppUrl } from "@/lib/app-url";
import { DISCORD_EMBED_COLOR } from "@/lib/discord-colors";
import { isRefineEligible, loadMaxRefineLevel } from "@/lib/refine";
import { getMaxCardSlots, formatItemDisplayName } from "@/lib/card-slots-constants";

// Flujo de intercambio (TRADE) sobre la tabla Deal (antes TradeOffer — ver el
// rediseño de listings). Una oferta de trade es un Deal PENDING con item de
// contraoferta; aceptarla cierra el listing (resolución única). Se conservan
// los nombres de función y el contrato de formData para no tocar la UI del
// formulario/acciones (TradeOfferForm/TradeOfferActions).

export async function createTradeOffer(listingId: string, formData: FormData) {
  const session = await requireSession();
  const t = await getTranslations("errors");

  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (maintenanceModeEnabled && !session.user.isAdmin) {
    throw new Error(t("maintenanceMode"));
  }

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error(t("listingNotFound"));
  if (listing.type !== "TRADE") throw new Error(t("notTradeListing"));
  if (listing.status !== "ACTIVE") throw new Error(t("listingNotActive"));
  if (listing.posterId === session.user.discordId) {
    throw new Error(t("cannotOfferOwn"));
  }

  const createTradeOfferSchema = z.object({
    itemId: z.string().min(1, t("selectItem")),
    quantity: z.coerce.number().int().positive(t("positiveQuantity")),
    zenyOffered: z.coerce.number().int().nonnegative(t("nonNegativeZeny")),
  });

  const parsed = createTradeOfferSchema.safeParse({
    itemId: formData.get("itemId"),
    quantity: formData.get("quantity"),
    zenyOffered: formData.get("zenyOffered") || 0,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? t("invalidData"));
  }

  const item = await prisma.item.findUnique({ where: { id: parsed.data.itemId } });
  if (!item) throw new Error(t("itemNotFound"));

  const refineEligible = isRefineEligible(item);
  let refineLevel = 0;
  if (refineEligible) {
    const rawRefine = formData.get("refineLevel");
    refineLevel = typeof rawRefine === "string" && rawRefine !== "" ? Number(rawRefine) : 0;
    if (!Number.isInteger(refineLevel) || refineLevel < 0) {
      throw new Error(t("positiveRefine"));
    }
    const maxRefineLevel = await loadMaxRefineLevel();
    if (refineLevel > maxRefineLevel) {
      throw new Error(t("refineTooHigh", { max: maxRefineLevel }));
    }
  }

  const maxCardSlots = getMaxCardSlots(item);
  let cardSlots = 0;
  if (maxCardSlots > 0) {
    const rawCardSlots = formData.get("cardSlots");
    cardSlots = typeof rawCardSlots === "string" && rawCardSlots !== "" ? Number(rawCardSlots) : 0;
    if (!Number.isInteger(cardSlots) || cardSlots < 0) {
      throw new Error(t("positiveCardSlots"));
    }
    if (cardSlots > maxCardSlots) {
      throw new Error(t("cardSlotsTooHigh", { max: maxCardSlots }));
    }
  }

  // quantity del Deal = unidades del listing (en un trade siempre 1); la
  // cantidad del item ofrecido va en offeredQuantity.
  await prisma.deal.create({
    data: {
      listingId,
      userId: session.user.discordId,
      quantity: 1,
      offeredItemId: parsed.data.itemId,
      offeredQuantity: parsed.data.quantity,
      offeredRefine: refineLevel,
      offeredCardSlots: cardSlots,
      zenyOffered: parsed.data.zenyOffered,
    },
  });

  revalidatePath(`/market/${listingId}`);
  return listingCardState(listingId);
}

// Ownership + estado se comparten entre aceptar/rechazar/cancelar — solo cambia
// quién puede hacerlo y a qué estado se mueve.
async function loadOwnedPendingDeal(
  dealId: string,
  expectedOwner: "poster" | "offerer",
  discordId: string,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { listing: { include: { item: true } }, offeredItem: true, user: true },
  });
  if (!deal) throw new Error(t("offerNotFound"));
  if (deal.status !== "PENDING") throw new Error(t("offerNotPending"));

  const ownerId = expectedOwner === "poster" ? deal.listing.posterId : deal.userId;
  if (ownerId !== discordId) throw new Error(t("noPermissionOffer"));

  return deal;
}

export async function acceptTradeOffer(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");

  const deal = await loadOwnedPendingDeal(dealId, "poster", session.user.discordId, t);

  await prisma.$transaction(async (tx) => {
    // Bloqueo de la fila del listing para serializar aceptaciones concurrentes:
    // sin esto, dos aceptaciones del mismo listing podrían cerrarlo dos veces.
    // Ver el núcleo del rediseño en deals.ts.
    await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${deal.listingId} FOR UPDATE`;

    const listing = await tx.listing.findUnique({
      where: { id: deal.listingId },
      select: { status: true },
    });
    if (!listing || listing.status !== "ACTIVE") throw new Error(t("listingNotActive"));
    const current = await tx.deal.findUnique({ where: { id: dealId }, select: { status: true } });
    if (!current || current.status !== "PENDING") throw new Error(t("offerNotPending"));

    await tx.deal.update({ where: { id: dealId }, data: { status: "ACCEPTED" } });
    // El resto de ofertas pendientes del mismo listing quedan rechazadas: el
    // listing solo puede cerrarse con una (un trade es resolución única).
    await tx.deal.updateMany({
      where: { listingId: deal.listingId, status: "PENDING", id: { not: dealId } },
      data: { status: "REJECTED" },
    });
    await tx.listing.update({ where: { id: deal.listingId }, data: { status: "COMPLETED" } });
  });

  const appUrl = getAppUrl();
  const listingItemName = formatItemDisplayName(
    deal.listing.item.name,
    deal.listing.refineLevel,
    deal.listing.cardSlots,
  );
  const offeredItemName = formatItemDisplayName(
    deal.offeredItem!.name,
    deal.offeredRefine ?? 0,
    deal.offeredCardSlots ?? 0,
  );
  const zenyField =
    deal.zenyOffered > 0
      ? [{ name: tDiscord("fields.zenyIncluded"), value: String(deal.zenyOffered), inline: true }]
      : [];

  // En un trade ambas partes reciben algo, así que a diferencia de una compra
  // (donde solo se notifica al vendedor) se manda un DM a cada lado. Best-effort
  // (sendDirectMessage no tumba la transacción, ya cerrada arriba).
  await sendDirectMessage(deal.userId, {
    title: tDiscord("dm.tradeAcceptedForOfferer", {
      username: session.user.username,
      item: listingItemName,
    }),
    url: `${appUrl}/market/${deal.listingId}`,
    color: DISCORD_EMBED_COLOR.TRADE,
    itemIconUrl: `${appUrl}${deal.listing.item.iconUrl}`,
    fields: [{ name: tDiscord("fields.yourOffer"), value: offeredItemName, inline: true }, ...zenyField],
  });
  await sendDirectMessage(session.user.discordId, {
    title: tDiscord("dm.tradeAcceptedForPoster", {
      username: deal.user.username,
      item: listingItemName,
    }),
    url: `${appUrl}/market/${deal.listingId}`,
    color: DISCORD_EMBED_COLOR.TRADE,
    itemIconUrl: `${appUrl}${deal.offeredItem!.iconUrl}`,
    fields: [{ name: tDiscord("fields.youReceived"), value: offeredItemName, inline: true }, ...zenyField],
  });

  revalidatePath(`/market/${deal.listingId}`);
  revalidatePath("/market");
  return listingCardState(deal.listingId);
}

export async function rejectTradeOffer(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const deal = await loadOwnedPendingDeal(dealId, "poster", session.user.discordId, t);

  await prisma.deal.update({ where: { id: dealId }, data: { status: "REJECTED" } });
  revalidatePath(`/market/${deal.listingId}`);
  return listingCardState(deal.listingId);
}

export async function cancelTradeOffer(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const deal = await loadOwnedPendingDeal(dealId, "offerer", session.user.discordId, t);

  await prisma.deal.update({ where: { id: dealId }, data: { status: "CANCELLED" } });
  revalidatePath(`/market/${deal.listingId}`);
  return listingCardState(deal.listingId);
}
