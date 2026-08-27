"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, ilike, inArray, ne, or, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { deal, listing, user } from "@/db/schema";
import { requireSession } from "@/lib/guard";
import { loadMarketConfig } from "@/lib/market-config";
import { sendDirectMessage } from "@/lib/discord-bot";
import { getAppUrl } from "@/lib/app-url";
import { DISCORD_EMBED_COLOR } from "@/lib/discord-colors";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { availableFrom, isSoldOut } from "@/lib/deals";
import { listingCardState } from "@/lib/listing-card";

// El destinatario solo se puede elegir entre usuarios que ya han iniciado
// sesión alguna vez (los únicos de los que hay registro en User) — mismo
// patrón de búsqueda que searchItems, pero sobre username.
export async function searchUsers(query: string) {
  const session = await requireSession();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  return db
    .select({ id: user.id, username: user.username, avatarUrl: user.avatarUrl })
    .from(user)
    .where(and(ilike(user.username, `%${trimmed}%`), ne(user.id, session.user.discordId)))
    .orderBy(asc(user.username))
    .limit(20);
}

// Regalos enviados/recibidos, leídos ya del modelo unificado (Listing type=GIFT
// + Deal). Se mapean a la forma que espera GiftsHistory (sender/recipient/…)
// para no tocar la UI: el remitente es el poster; el destinatario es la
// contraparte del Deal (en un regalo con destinatario, único y ACCEPTED).
export async function getMyGifts() {
  const session = await requireSession();

  // Listings GIFT donde soy el que regala (posterId) O el reclamante (algún Deal
  // mío). El "algún Deal mío" se expresa como subconsulta de ids (equivale al
  // `deals: { some }` de Prisma) para no correlacionar dentro del query relacional.
  const myClaimListingIds = db
    .select({ id: deal.listingId })
    .from(deal)
    .where(eq(deal.userId, session.user.discordId));

  const listings = await db.query.listing.findMany({
    where: and(
      eq(listing.type, "GIFT"),
      or(eq(listing.posterId, session.user.discordId), inArray(listing.id, myClaimListingIds)),
    ),
    orderBy: desc(listing.createdAt),
    with: {
      // select en item (no fila completa): la UI de regalos solo usa nombre/
      // icono/slots. poster/user (pequeños) se dejan completos.
      item: { columns: { id: true, name: true, iconUrl: true, slotCount: true } },
      poster: true,
      options: { with: { def: true }, orderBy: (o) => asc(o.slotIndex) },
      deals: { with: { user: true } },
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
        cardSlots: l.item.slotCount,
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

  const giftListing = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM "Listing" WHERE id = ${listingId} FOR UPDATE`);
    const row = await tx.query.listing.findFirst({ where: eq(listing.id, listingId), with: { item: true } });
    if (!row) throw new Error(t("listingNotFound"));
    if (row.posterId === session.user.discordId) throw new Error(t("cannotClaimOwn"));
    if (row.status !== "ACTIVE") throw new Error(t("listingNotActive"));
    if (row.type !== "GIFT") throw new Error(t("notClaimableGift"));

    // Disponible = cantidad − reclamado − reservado (las reclamaciones PENDING
    // retienen unidades hasta que el que regala confirma).
    const agg = await tx
      .select({ status: deal.status, quantity: sum(deal.quantity) })
      .from(deal)
      .where(and(eq(deal.listingId, listingId), inArray(deal.status, ["ACCEPTED", "PENDING"])))
      .groupBy(deal.status);
    const claimed = Number(agg.find((a) => a.status === "ACCEPTED")?.quantity ?? 0);
    const reserved = Number(agg.find((a) => a.status === "PENDING")?.quantity ?? 0);
    // Un GIFT siempre tiene tope, así que available nunca es null aquí; se usa
    // el helper para no repetir la resta y por consistencia con el resto.
    const available = availableFrom(row.quantity, claimed, reserved);
    if (available !== null && quantity > available) {
      throw new Error(t("notEnoughStock", { remaining: available }));
    }

    await tx
      .insert(deal)
      .values({ listingId, userId: session.user.discordId, quantity, status: "PENDING", unitPrice: null });
    return row;
  });

  const appUrl = getAppUrl();
  await sendDirectMessage(giftListing.posterId, {
    title: tDiscord("dm.giftClaimRequested", {
      username: session.user.username,
      item: formatItemDisplayName(giftListing.item.name, giftListing.refineLevel, giftListing.item.slotCount),
    }),
    url: `${appUrl}/market/${listingId}`,
    color: DISCORD_EMBED_COLOR.GIFT,
    itemIconUrl: `${appUrl}${giftListing.item.iconUrl}`,
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
  const dealRow = await db.query.deal.findFirst({
    where: eq(deal.id, dealId),
    with: { listing: { with: { item: true } }, user: true },
  });
  if (!dealRow) throw new Error(t("offerNotFound"));
  if (dealRow.status !== "PENDING") throw new Error(t("offerNotPending"));
  if (dealRow.listing.type !== "GIFT") throw new Error(t("notClaimableGift"));
  const ownerId = expectedOwner === "giver" ? dealRow.listing.posterId : dealRow.userId;
  if (ownerId !== discordId) throw new Error(t("noPermissionOffer"));
  return dealRow;
}

// El que regala CONFIRMA una reclamación: cuenta como entregada; si se agota la
// cantidad, el listing pasa a COMPLETED.
export async function acceptGiftClaim(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");
  const tField = await getTranslations("market.field");

  const dealRow = await loadOwnedPendingGiftDeal(dealId, "giver", session.user.discordId, t);

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM "Listing" WHERE id = ${dealRow.listingId} FOR UPDATE`);
    const [cur] = await tx
      .select({ status: deal.status, quantity: deal.quantity })
      .from(deal)
      .where(eq(deal.id, dealId))
      .limit(1);
    if (!cur || cur.status !== "PENDING") throw new Error(t("offerNotPending"));
    const [giftListing] = await tx
      .select({ quantity: listing.quantity, status: listing.status })
      .from(listing)
      .where(eq(listing.id, dealRow.listingId))
      .limit(1);
    if (!giftListing || giftListing.status !== "ACTIVE") throw new Error(t("listingNotActive"));

    await tx.update(deal).set({ status: "ACCEPTED" }).where(eq(deal.id, dealId));
    // Entregado = Σ cantidad de los Deal ACCEPTED (incluido el recién aceptado).
    const [claimedAgg] = await tx
      .select({ quantity: sum(deal.quantity) })
      .from(deal)
      .where(and(eq(deal.listingId, dealRow.listingId), eq(deal.status, "ACCEPTED")));
    const claimed = Number(claimedAgg?.quantity ?? 0);
    await tx
      .update(listing)
      .set({ status: isSoldOut(giftListing.quantity, claimed) ? "COMPLETED" : "ACTIVE" })
      .where(eq(listing.id, dealRow.listingId));
  });

  const appUrl = getAppUrl();
  await sendDirectMessage(dealRow.userId, {
    title: tDiscord("dm.giftClaimAccepted", {
      username: session.user.username,
      item: formatItemDisplayName(dealRow.listing.item.name, dealRow.listing.refineLevel, dealRow.listing.item.slotCount),
    }),
    url: `${appUrl}/market/${dealRow.listingId}`,
    color: DISCORD_EMBED_COLOR.GIFT,
    itemIconUrl: `${appUrl}${dealRow.listing.item.iconUrl}`,
    fields: [
      { name: tField("quantity"), value: String(dealRow.quantity), inline: true },
      { name: tDiscord("fields.from"), value: `<@${session.user.discordId}>`, inline: false },
    ],
  });

  revalidatePath("/market");
  revalidatePath(`/market/${dealRow.listingId}`);
  return listingCardState(dealRow.listingId);
}

// El que regala RECHAZA una reclamación: libera las unidades retenidas.
export async function rejectGiftClaim(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");

  const dealRow = await loadOwnedPendingGiftDeal(dealId, "giver", session.user.discordId, t);
  await db.update(deal).set({ status: "REJECTED" }).where(eq(deal.id, dealId));

  const appUrl = getAppUrl();
  await sendDirectMessage(dealRow.userId, {
    title: tDiscord("dm.giftClaimRejected", {
      username: session.user.username,
      item: formatItemDisplayName(dealRow.listing.item.name, dealRow.listing.refineLevel, dealRow.listing.item.slotCount),
    }),
    url: `${appUrl}/market/${dealRow.listingId}`,
    color: DISCORD_EMBED_COLOR.GIFT,
    itemIconUrl: `${appUrl}${dealRow.listing.item.iconUrl}`,
    fields: [{ name: tDiscord("fields.from"), value: `<@${session.user.discordId}>`, inline: false }],
  });

  revalidatePath(`/market/${dealRow.listingId}`);
  return listingCardState(dealRow.listingId);
}

// El reclamante CANCELA su propia reclamación pendiente.
export async function cancelGiftClaim(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const dealRow = await loadOwnedPendingGiftDeal(dealId, "claimer", session.user.discordId, t);
  await db.update(deal).set({ status: "CANCELLED" }).where(eq(deal.id, dealId));
  revalidatePath(`/market/${dealRow.listingId}`);
  return listingCardState(dealRow.listingId);
}
