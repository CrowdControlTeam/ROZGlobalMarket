"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { loadMarketConfig } from "@/lib/market-config";
import { sendDirectMessage } from "@/lib/discord-bot";
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
    recipientId: z.string().min(1, t("selectRecipient")),
    quantity: z.coerce.number().int().positive(t("positiveQuantity")),
  });

  const parsed = sendGiftSchema.safeParse({
    itemId: formData.get("itemId"),
    recipientId: formData.get("recipientId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? t("invalidData"));
  }
  if (parsed.data.recipientId === session.user.discordId) {
    throw new Error(t("cannotGiftSelf"));
  }

  const [item, recipient] = await Promise.all([
    prisma.item.findUnique({ where: { id: parsed.data.itemId } }),
    prisma.user.findUnique({ where: { id: parsed.data.recipientId } }),
  ]);
  if (!item) throw new Error(t("itemNotFound"));
  if (!recipient) throw new Error(t("recipientNotFound"));

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

  // Un regalo con random options es una instancia única (mismo criterio
  // que una venta option-eligible en listings.ts) — se fuerza aquí también
  // porque no hay que confiar en lo que mande el cliente.
  const quantity = optionGroup !== null ? 1 : parsed.data.quantity;

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

  const gift = await prisma.gift.create({
    data: {
      senderId: session.user.discordId,
      recipientId: parsed.data.recipientId,
      itemId: parsed.data.itemId,
      quantity,
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

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const itemName = formatItemDisplayName(item.name, refineLevel, cardSlots);
  await sendDirectMessage(parsed.data.recipientId, {
    title: tDiscord("dm.gifted", { username: session.user.username, item: itemName }),
    url: `${appUrl}/market/gifts`,
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
    ],
  });

  revalidatePath("/market/gifts");
  return { id: gift.id };
}

export async function getMyGifts() {
  const session = await requireSession();

  return prisma.gift.findMany({
    where: {
      OR: [{ senderId: session.user.discordId }, { recipientId: session.user.discordId }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      item: true,
      sender: true,
      recipient: true,
      options: { include: { def: true }, orderBy: { slotIndex: "asc" } },
    },
  });
}
