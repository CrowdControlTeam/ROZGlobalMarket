"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { loadMarketConfig } from "@/lib/market-config";
import { sendDirectMessage } from "@/lib/discord-bot";
import { getAppUrl } from "@/lib/app-url";
import { DISCORD_EMBED_COLOR } from "@/lib/discord-colors";
import { isRefineEligible, loadMaxRefineLevel } from "@/lib/refine";
import { getMaxCardSlots, formatItemDisplayName } from "@/lib/card-slots-constants";

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

  await prisma.tradeOffer.create({
    data: {
      listingId,
      offererId: session.user.discordId,
      itemId: parsed.data.itemId,
      quantity: parsed.data.quantity,
      refineLevel,
      cardSlots,
      zenyOffered: parsed.data.zenyOffered,
    },
  });

  revalidatePath(`/market/${listingId}`);
}

// Ownership + estado se comparten entre aceptar/rechazar/cancelar — solo
// cambia quién puede hacerlo y a qué estado se mueve.
async function loadOwnedPendingOffer(
  offerId: string,
  expectedOwnerField: "posterId" | "offererId",
  discordId: string,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  const offer = await prisma.tradeOffer.findUnique({
    where: { id: offerId },
    include: { listing: { include: { item: true } }, item: true, offerer: true },
  });
  if (!offer) throw new Error(t("offerNotFound"));
  if (offer.status !== "PENDING") throw new Error(t("offerNotPending"));

  const ownerId = expectedOwnerField === "posterId" ? offer.listing.posterId : offer.offererId;
  if (ownerId !== discordId) throw new Error(t("noPermissionOffer"));

  return offer;
}

export async function acceptTradeOffer(offerId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");

  const offer = await loadOwnedPendingOffer(offerId, "posterId", session.user.discordId, t);

  await prisma.$transaction(async (tx) => {
    await tx.tradeOffer.update({ where: { id: offerId }, data: { status: "ACCEPTED" } });
    // El resto de ofertas pendientes del mismo listing quedan rechazadas
    // automáticamente: el listing solo puede cerrarse con una.
    await tx.tradeOffer.updateMany({
      where: { listingId: offer.listingId, status: "PENDING", id: { not: offerId } },
      data: { status: "REJECTED" },
    });
    // Se reutiliza ListingStatus.SOLD para "cerrado" también en trades (no
    // hay Purchase asociada: Purchase.unitPrice es obligatorio y no encaja
    // con un intercambio) — la UI muestra "Intercambiada" en vez de
    // "Vendida" cuando type = TRADE, ver STATUS_LABEL en market/[id]/page.tsx.
    await tx.listing.update({ where: { id: offer.listingId }, data: { status: "SOLD" } });
  });

  const appUrl = getAppUrl();
  const listingItemName = formatItemDisplayName(
    offer.listing.item.name,
    offer.listing.refineLevel,
    offer.listing.cardSlots,
  );
  const offeredItemName = formatItemDisplayName(offer.item.name, offer.refineLevel, offer.cardSlots);
  const zenyField =
    offer.zenyOffered > 0
      ? [{ name: tDiscord("fields.zenyIncluded"), value: String(offer.zenyOffered), inline: true }]
      : [];

  // Norma 2.10 del plan original: en un trade ambas partes reciben algo, así que a
  // diferencia de una compra normal (donde solo se notifica al vendedor,
  // que es pasivo) aquí se manda un DM a cada lado — el que acepta ya sabe
  // que ha aceptado, pero no tiene constancia por Discord de lo recibido.
  await sendDirectMessage(offer.offererId, {
    title: tDiscord("dm.tradeAcceptedForOfferer", {
      username: session.user.username,
      item: listingItemName,
    }),
    url: `${appUrl}/market/${offer.listingId}`,
    color: DISCORD_EMBED_COLOR.TRADE,
    itemIconUrl: `${appUrl}${offer.listing.item.iconUrl}`,
    fields: [{ name: tDiscord("fields.yourOffer"), value: offeredItemName, inline: true }, ...zenyField],
  });
  await sendDirectMessage(session.user.discordId, {
    title: tDiscord("dm.tradeAcceptedForPoster", {
      username: offer.offerer.username,
      item: listingItemName,
    }),
    url: `${appUrl}/market/${offer.listingId}`,
    color: DISCORD_EMBED_COLOR.TRADE,
    itemIconUrl: `${appUrl}${offer.item.iconUrl}`,
    fields: [{ name: tDiscord("fields.youReceived"), value: offeredItemName, inline: true }, ...zenyField],
  });

  revalidatePath(`/market/${offer.listingId}`);
  revalidatePath("/market");
}

export async function rejectTradeOffer(offerId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const offer = await loadOwnedPendingOffer(offerId, "posterId", session.user.discordId, t);

  await prisma.tradeOffer.update({ where: { id: offerId }, data: { status: "REJECTED" } });
  revalidatePath(`/market/${offer.listingId}`);
}

export async function cancelTradeOffer(offerId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const offer = await loadOwnedPendingOffer(offerId, "offererId", session.user.discordId, t);

  await prisma.tradeOffer.update({ where: { id: offerId }, data: { status: "CANCELLED" } });
  revalidatePath(`/market/${offer.listingId}`);
}
