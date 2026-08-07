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
import { formatOptionAmount } from "@/lib/market-labels";
import {
  getItemOptionGroup,
  loadMagicalWeaponTypes,
  isOptionsFeatureAvailable,
  parseOptionsFromFormData,
  validateOptions,
} from "@/lib/item-options";
import { availableFrom, isSoldOut } from "@/lib/deals";
import { listingCardState } from "@/lib/listing-card";

// El destinatario solo se puede elegir entre usuarios que ya han iniciado
// sesión alguna vez (los únicos de los que hay registro en User) — mismo
// patrón de búsqueda que searchItems, pero sobre username.
export async function searchUsers(query: string) {
  const session = await requireSession();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  return prisma.user.findMany({
    where: {
      username: { contains: trimmed, mode: "insensitive" },
      id: { not: session.user.discordId },
    },
    orderBy: { username: "asc" },
    take: 20,
    select: { id: true, username: true, avatarUrl: true },
  });
}

export async function sendGift(formData: FormData) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");
  const tField = await getTranslations("market.field");

  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (maintenanceModeEnabled && !session.user.isAdmin) {
    throw new Error(t("maintenanceMode"));
  }

  const sendGiftSchema = z.object({
    itemId: z.string().min(1, t("selectItem")),
    // Opcional: sin destinatario, el regalo es RECLAMABLE por cualquiera.
    recipientId: z.string().min(1).optional(),
    quantity: z.coerce.number().int().positive(t("positiveQuantity")),
  });

  const parsed = sendGiftSchema.safeParse({
    itemId: formData.get("itemId"),
    recipientId: formData.get("recipientId") || undefined,
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? t("invalidData"));
  }
  const recipientId = parsed.data.recipientId;
  if (recipientId === session.user.discordId) {
    throw new Error(t("cannotGiftSelf"));
  }

  const [item, recipient] = await Promise.all([
    prisma.item.findUnique({ where: { id: parsed.data.itemId } }),
    recipientId ? prisma.user.findUnique({ where: { id: recipientId } }) : Promise.resolve(null),
  ]);
  if (!item) throw new Error(t("itemNotFound"));
  if (recipientId && !recipient) throw new Error(t("recipientNotFound"));

  const [magicalTypes, optionsAvailable] = await Promise.all([
    loadMagicalWeaponTypes(),
    isOptionsFeatureAvailable(),
  ]);
  const optionGroup = optionsAvailable ? getItemOptionGroup(item, magicalTypes) : null;

  const rawOptions = await parseOptionsFromFormData(formData);
  // Roll exacto de una instancia real (mismo sentido que en SALE/TRADE, a
  // diferencia del "mínimo deseado" de BUY — ver comentario de
  // ListingOption en schema.prisma).
  const defsById = await validateOptions(rawOptions, optionGroup);

  // Ya NO se fuerza a 1 un regalo con options: se deja la cantidad que ponga el
  // usuario (mismo criterio de flexibilidad que SALE en listings.ts). Un GIFT
  // nunca es ilimitado (el parseo exige entero positivo más arriba).
  const quantity = parsed.data.quantity;

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

  // Con destinatario = envío directo instantáneo: Listing(GIFT) ya cerrado
  // (COMPLETED) + un Deal ACCEPTED para el destinatario. SIN destinatario =
  // regalo RECLAMABLE: Listing(GIFT) ACTIVE que cualquiera puede reclamar
  // (reserva→confirmación, gratis), sin Deal hasta que alguien lo reclame.
  const listing = await prisma.$transaction(async (tx) => {
    const created = await tx.listing.create({
      data: {
        posterId: session.user.discordId,
        itemId: parsed.data.itemId,
        type: "GIFT",
        quantity,
        price: null,
        status: recipientId ? "COMPLETED" : "ACTIVE",
        refineLevel,
        cardSlots,
        options:
          rawOptions.length > 0
            ? {
                create: rawOptions.map((o) => ({
                  slotIndex: o.slotIndex,
                  defId: o.defId,
                  value: o.value,
                })),
              }
            : undefined,
      },
    });
    if (recipientId) {
      await tx.deal.create({
        data: {
          listingId: created.id,
          userId: recipientId,
          quantity,
          status: "ACCEPTED",
          unitPrice: null,
        },
      });
    }
    return created;
  });

  // DM solo en el regalo con destinatario; el reclamable no tiene a quién
  // avisar al crear — se "anuncia" apareciendo en el mercado.
  if (recipientId) {
    const appUrl = getAppUrl();
    const itemName = formatItemDisplayName(item.name, refineLevel, cardSlots);
    await sendDirectMessage(recipientId, {
      title: tDiscord("dm.gifted", { username: session.user.username, item: itemName }),
      url: `${appUrl}/my/gifts`,
      color: DISCORD_EMBED_COLOR.GIFT,
      itemIconUrl: `${appUrl}${item.iconUrl}`,
      fields: [
        { name: tField("quantity"), value: String(quantity), inline: true },
        ...(rawOptions.length > 0
          ? [
              {
                name: tField("options"),
                value: rawOptions
                  .map((o) => `${defsById.get(o.defId)!.label}: ${formatOptionAmount(o.value, false)}`)
                  .join("\n"),
                inline: false,
              },
            ]
          : []),
        { name: tDiscord("fields.from"), value: `<@${session.user.discordId}>`, inline: false },
      ],
    });
  }

  revalidatePath("/my/gifts");
  revalidatePath("/market");
  return { id: listing.id };
}

// Regalos enviados/recibidos, leídos ya del modelo unificado (Listing type=GIFT
// + Deal). Se mapean a la forma que espera GiftsHistory (sender/recipient/…)
// para no tocar la UI: el remitente es el poster; el destinatario es la
// contraparte del Deal (en un regalo con destinatario, único y ACCEPTED).
export async function getMyGifts() {
  const session = await requireSession();

  const listings = await prisma.listing.findMany({
    where: {
      type: "GIFT",
      OR: [
        { posterId: session.user.discordId },
        { deals: { some: { userId: session.user.discordId } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      item: true,
      poster: true,
      options: { include: { def: true }, orderBy: { slotIndex: "asc" } },
      deals: { include: { user: true } },
    },
  });

  return listings
    .map((l) => {
      const recipientDeal = l.deals[0];
      if (!recipientDeal) return null;
      return {
        id: l.id,
        senderId: l.posterId,
        sender: l.poster,
        recipientId: recipientDeal.userId,
        recipient: recipientDeal.user,
        item: l.item,
        options: l.options,
        refineLevel: l.refineLevel,
        cardSlots: l.cardSlots,
        // Un GIFT siempre tiene tope (nunca es "ilimitado"), pero Listing.quantity
        // es nullable a nivel de esquema; el ?? 1 es solo para el tipo.
        quantity: l.quantity ?? 1,
        createdAt: l.createdAt,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);
}

// ── Regalo RECLAMABLE: alguien reclama, el que regala confirma ──
// Mismo mecanismo de reserva→confirmación que una venta, pero gratis
// (unitPrice null). La contraparte (Deal.userId) es el reclamante. Un regalo
// reclamable es un Listing(GIFT) ACTIVE (el que tiene destinatario nace ya
// COMPLETED, así que la comprobación de ACTIVE ya lo excluye).

export async function claimGift(listingId: string, formData: FormData) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");
  const tField = await getTranslations("market.field");

  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (maintenanceModeEnabled && !session.user.isAdmin) throw new Error(t("maintenanceMode"));

  const schema = z.object({ quantity: z.coerce.number().int().positive(t("positiveQuantity")) });
  const parsed = schema.safeParse({ quantity: formData.get("quantity") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? t("invalidData"));
  const { quantity } = parsed.data;

  const listing = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${listingId} FOR UPDATE`;
    const listing = await tx.listing.findUnique({ where: { id: listingId }, include: { item: true } });
    if (!listing) throw new Error(t("listingNotFound"));
    if (listing.posterId === session.user.discordId) throw new Error(t("cannotClaimOwn"));
    if (listing.status !== "ACTIVE") throw new Error(t("listingNotActive"));
    if (listing.type !== "GIFT") throw new Error(t("notClaimableGift"));

    // Disponible = cantidad − reclamado − reservado (las reclamaciones PENDING
    // retienen unidades hasta que el que regala confirma).
    const agg = await tx.deal.groupBy({
      by: ["status"],
      where: { listingId, status: { in: ["ACCEPTED", "PENDING"] } },
      _sum: { quantity: true },
    });
    const claimed = agg.find((a) => a.status === "ACCEPTED")?._sum.quantity ?? 0;
    const reserved = agg.find((a) => a.status === "PENDING")?._sum.quantity ?? 0;
    // Un GIFT siempre tiene tope, así que available nunca es null aquí; se usa
    // el helper para no repetir la resta y por consistencia con el resto.
    const available = availableFrom(listing.quantity, claimed, reserved);
    if (available !== null && quantity > available) {
      throw new Error(t("notEnoughStock", { remaining: available }));
    }

    await tx.deal.create({
      data: { listingId, userId: session.user.discordId, quantity, status: "PENDING", unitPrice: null },
    });
    return listing;
  });

  const appUrl = getAppUrl();
  await sendDirectMessage(listing.posterId, {
    title: tDiscord("dm.giftClaimRequested", {
      username: session.user.username,
      item: formatItemDisplayName(listing.item.name, listing.refineLevel, listing.cardSlots),
    }),
    url: `${appUrl}/market/${listingId}`,
    color: DISCORD_EMBED_COLOR.GIFT,
    itemIconUrl: `${appUrl}${listing.item.iconUrl}`,
    fields: [
      { name: tField("quantity"), value: String(quantity), inline: true },
      { name: tDiscord("fields.to"), value: `<@${session.user.discordId}>`, inline: false },
    ],
  });

  revalidatePath("/market");
  revalidatePath(`/market/${listingId}`);
  return listingCardState(listingId);
}

async function loadOwnedPendingGiftDeal(
  dealId: string,
  expectedOwner: "giver" | "claimer",
  discordId: string,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { listing: { include: { item: true } }, user: true },
  });
  if (!deal) throw new Error(t("offerNotFound"));
  if (deal.status !== "PENDING") throw new Error(t("offerNotPending"));
  if (deal.listing.type !== "GIFT") throw new Error(t("notClaimableGift"));
  const ownerId = expectedOwner === "giver" ? deal.listing.posterId : deal.userId;
  if (ownerId !== discordId) throw new Error(t("noPermissionOffer"));
  return deal;
}

// El que regala CONFIRMA una reclamación: cuenta como entregada; si se agota la
// cantidad, el listing pasa a COMPLETED.
export async function acceptGiftClaim(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");
  const tField = await getTranslations("market.field");

  const deal = await loadOwnedPendingGiftDeal(dealId, "giver", session.user.discordId, t);

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${deal.listingId} FOR UPDATE`;
    const cur = await tx.deal.findUnique({ where: { id: dealId }, select: { status: true, quantity: true } });
    if (!cur || cur.status !== "PENDING") throw new Error(t("offerNotPending"));
    const listing = await tx.listing.findUnique({
      where: { id: deal.listingId },
      select: { quantity: true, status: true },
    });
    if (!listing || listing.status !== "ACTIVE") throw new Error(t("listingNotActive"));

    await tx.deal.update({ where: { id: dealId }, data: { status: "ACCEPTED" } });
    // Entregado = Σ cantidad de los Deal ACCEPTED (incluido el recién aceptado).
    const claimedAgg = await tx.deal.aggregate({
      where: { listingId: deal.listingId, status: "ACCEPTED" },
      _sum: { quantity: true },
    });
    const claimed = claimedAgg._sum.quantity ?? 0;
    await tx.listing.update({
      where: { id: deal.listingId },
      data: { status: isSoldOut(listing.quantity, claimed) ? "COMPLETED" : "ACTIVE" },
    });
  });

  const appUrl = getAppUrl();
  await sendDirectMessage(deal.userId, {
    title: tDiscord("dm.giftClaimAccepted", {
      username: session.user.username,
      item: formatItemDisplayName(deal.listing.item.name, deal.listing.refineLevel, deal.listing.cardSlots),
    }),
    url: `${appUrl}/market/${deal.listingId}`,
    color: DISCORD_EMBED_COLOR.GIFT,
    itemIconUrl: `${appUrl}${deal.listing.item.iconUrl}`,
    fields: [
      { name: tField("quantity"), value: String(deal.quantity), inline: true },
      { name: tDiscord("fields.from"), value: `<@${session.user.discordId}>`, inline: false },
    ],
  });

  revalidatePath("/market");
  revalidatePath(`/market/${deal.listingId}`);
  return listingCardState(deal.listingId);
}

// El que regala RECHAZA una reclamación: libera las unidades retenidas.
export async function rejectGiftClaim(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");

  const deal = await loadOwnedPendingGiftDeal(dealId, "giver", session.user.discordId, t);
  await prisma.deal.update({ where: { id: dealId }, data: { status: "REJECTED" } });

  const appUrl = getAppUrl();
  await sendDirectMessage(deal.userId, {
    title: tDiscord("dm.giftClaimRejected", {
      username: session.user.username,
      item: formatItemDisplayName(deal.listing.item.name, deal.listing.refineLevel, deal.listing.cardSlots),
    }),
    url: `${appUrl}/market/${deal.listingId}`,
    color: DISCORD_EMBED_COLOR.GIFT,
    itemIconUrl: `${appUrl}${deal.listing.item.iconUrl}`,
    fields: [{ name: tDiscord("fields.from"), value: `<@${session.user.discordId}>`, inline: false }],
  });

  revalidatePath(`/market/${deal.listingId}`);
  return listingCardState(deal.listingId);
}

// El reclamante CANCELA su propia reclamación pendiente.
export async function cancelGiftClaim(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const deal = await loadOwnedPendingGiftDeal(dealId, "claimer", session.user.discordId, t);
  await prisma.deal.update({ where: { id: dealId }, data: { status: "CANCELLED" } });
  revalidatePath(`/market/${deal.listingId}`);
  return listingCardState(deal.listingId);
}
