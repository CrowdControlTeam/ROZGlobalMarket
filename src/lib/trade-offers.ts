"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { deal, item as itemTable, listing } from "@/db/schema";
import { requireSession } from "@/lib/guard";
import { listingCardState } from "@/lib/listing-card";
import { loadMarketConfig } from "@/lib/market-config";
import { sendDirectMessage } from "@/lib/discord-bot";
import { getAppUrl } from "@/lib/app-url";
import { DISCORD_EMBED_COLOR } from "@/lib/discord-colors";
import { isRefineEligible, loadMaxRefineLevel } from "@/lib/refine";
import { formatItemDisplayName } from "@/lib/card-slots-constants";

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

  const listingRow = await db.query.listing.findFirst({
    where: eq(listing.id, listingId),
    with: { item: true },
  });
  if (!listingRow) throw new Error(t("listingNotFound"));
  if (listingRow.type !== "TRADE") throw new Error(t("notTradeListing"));
  if (listingRow.status !== "ACTIVE") throw new Error(t("listingNotActive"));
  if (listingRow.posterId === session.user.discordId) {
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

  const [item] = await db.select().from(itemTable).where(eq(itemTable.id, parsed.data.itemId)).limit(1);
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

  // Las ranuras del item ofrecido son fijas por item (offeredItem.slotCount), no
  // se piden ni se guardan.

  // quantity del Deal = unidades del listing que se llevan a cambio. El trade es
  // por el LOTE COMPLETO (no parcial), así que se toma la cantidad entera del
  // listing (aceptar cierra el listing entero — ver acceptTradeOffer); así el
  // "vendido" queda correcto (p. ej. 500 de 500, no 1 de 500). La cantidad del
  // item OFRECIDO va aparte en offeredQuantity. TRADE nunca es ilimitado, así
  // que listing.quantity no es null (el ?? 1 es solo por seguridad de tipos).
  await db.insert(deal).values({
    listingId,
    userId: session.user.discordId,
    quantity: listingRow.quantity ?? 1,
    offeredItemId: parsed.data.itemId,
    offeredQuantity: parsed.data.quantity,
    offeredRefine: refineLevel,
    zenyOffered: parsed.data.zenyOffered,
  });

  // Aviso al poster de que le han ofrecido un intercambio (coherente con
  // venta/compra/regalo, que también avisan al recibir la oferta). Best-effort.
  const appUrl = getAppUrl();
  const tDiscord = await getTranslations("discord");
  const zenyField =
    parsed.data.zenyOffered > 0
      ? [{ name: tDiscord("fields.zenyIncluded"), value: String(parsed.data.zenyOffered), inline: true }]
      : [];
  await sendDirectMessage(listingRow.posterId, {
    title: tDiscord("dm.tradeOffered", {
      username: session.user.username,
      item: formatItemDisplayName(listingRow.item.name, listingRow.refineLevel, listingRow.item.slotCount),
    }),
    url: `${appUrl}/market/${listingId}`,
    color: DISCORD_EMBED_COLOR.TRADE,
    itemIconUrl: `${appUrl}${listingRow.item.iconUrl}`,
    fields: [
      { name: tDiscord("fields.offeredItem"), value: formatItemDisplayName(item.name, refineLevel, item.slotCount), inline: true },
      ...zenyField,
      { name: tDiscord("fields.offerer"), value: `<@${session.user.discordId}>`, inline: false },
    ],
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
  const dealRow = await db.query.deal.findFirst({
    where: eq(deal.id, dealId),
    with: { listing: { with: { item: true } }, offeredItem: true, user: true },
  });
  if (!dealRow) throw new Error(t("offerNotFound"));
  if (dealRow.status !== "PENDING") throw new Error(t("offerNotPending"));

  const ownerId = expectedOwner === "poster" ? dealRow.listing.posterId : dealRow.userId;
  if (ownerId !== discordId) throw new Error(t("noPermissionOffer"));

  return dealRow;
}

export async function acceptTradeOffer(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");

  const dealRow = await loadOwnedPendingDeal(dealId, "poster", session.user.discordId, t);

  await db.transaction(async (tx) => {
    // Bloqueo de la fila del listing para serializar aceptaciones concurrentes:
    // sin esto, dos aceptaciones del mismo listing podrían cerrarlo dos veces.
    // Ver el núcleo del rediseño en deals.ts.
    await tx.execute(sql`SELECT id FROM "Listing" WHERE id = ${dealRow.listingId} FOR UPDATE`);

    const [currentListing] = await tx
      .select({ status: listing.status })
      .from(listing)
      .where(eq(listing.id, dealRow.listingId))
      .limit(1);
    if (!currentListing || currentListing.status !== "ACTIVE") throw new Error(t("listingNotActive"));
    const [current] = await tx
      .select({ status: deal.status })
      .from(deal)
      .where(eq(deal.id, dealId))
      .limit(1);
    if (!current || current.status !== "PENDING") throw new Error(t("offerNotPending"));

    await tx.update(deal).set({ status: "ACCEPTED" }).where(eq(deal.id, dealId));
    // El resto de ofertas pendientes del mismo listing quedan rechazadas: el
    // listing solo puede cerrarse con una (un trade es resolución única).
    await tx
      .update(deal)
      .set({ status: "REJECTED" })
      .where(and(eq(deal.listingId, dealRow.listingId), eq(deal.status, "PENDING"), ne(deal.id, dealId)));
    await tx.update(listing).set({ status: "COMPLETED" }).where(eq(listing.id, dealRow.listingId));
  });

  const appUrl = getAppUrl();
  const listingItemName = formatItemDisplayName(
    dealRow.listing.item.name,
    dealRow.listing.refineLevel,
    dealRow.listing.item.slotCount,
  );
  const offeredItemName = formatItemDisplayName(
    dealRow.offeredItem!.name,
    dealRow.offeredRefine ?? 0,
    dealRow.offeredItem!.slotCount,
  );
  const zenyField =
    dealRow.zenyOffered > 0
      ? [{ name: tDiscord("fields.zenyIncluded"), value: String(dealRow.zenyOffered), inline: true }]
      : [];

  // En un trade ambas partes reciben algo, así que a diferencia de una compra
  // (donde solo se notifica al vendedor) se manda un DM a cada lado. Best-effort
  // (sendDirectMessage no tumba la transacción, ya cerrada arriba).
  await sendDirectMessage(dealRow.userId, {
    title: tDiscord("dm.tradeAcceptedForOfferer", {
      username: session.user.username,
      item: listingItemName,
    }),
    url: `${appUrl}/market/${dealRow.listingId}`,
    color: DISCORD_EMBED_COLOR.TRADE,
    itemIconUrl: `${appUrl}${dealRow.listing.item.iconUrl}`,
    fields: [
      { name: tDiscord("fields.yourOffer"), value: offeredItemName, inline: true },
      ...zenyField,
      { name: tDiscord("fields.tradedWith"), value: `<@${session.user.discordId}>`, inline: false },
    ],
  });
  await sendDirectMessage(session.user.discordId, {
    title: tDiscord("dm.tradeAcceptedForPoster", {
      username: dealRow.user.username,
      item: listingItemName,
    }),
    url: `${appUrl}/market/${dealRow.listingId}`,
    color: DISCORD_EMBED_COLOR.TRADE,
    itemIconUrl: `${appUrl}${dealRow.offeredItem!.iconUrl}`,
    fields: [
      { name: tDiscord("fields.youReceived"), value: offeredItemName, inline: true },
      ...zenyField,
      { name: tDiscord("fields.tradedWith"), value: `<@${dealRow.userId}>`, inline: false },
    ],
  });

  revalidatePath(`/market/${dealRow.listingId}`);
  revalidatePath("/market");
  return listingCardState(dealRow.listingId);
}

export async function rejectTradeOffer(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const dealRow = await loadOwnedPendingDeal(dealId, "poster", session.user.discordId, t);

  await db.update(deal).set({ status: "REJECTED" }).where(eq(deal.id, dealId));
  revalidatePath(`/market/${dealRow.listingId}`);
  return listingCardState(dealRow.listingId);
}

export async function cancelTradeOffer(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const dealRow = await loadOwnedPendingDeal(dealId, "offerer", session.user.discordId, t);

  await db.update(deal).set({ status: "CANCELLED" }).where(eq(deal.id, dealId));
  revalidatePath(`/market/${dealRow.listingId}`);
  return listingCardState(dealRow.listingId);
}
