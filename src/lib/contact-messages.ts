"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { sendDirectMessage, isDmFeatureAvailable } from "@/lib/discord-bot";
import { DISCORD_EMBED_COLOR } from "@/lib/discord-colors";

// Mensaje libre desde un nombre clicable (ver UserMention.tsx) — a
// diferencia del resto de DMs (compra, trade aceptado, regalo, todas
// disparadas por una transacción real ya guardada), este lo escribe la
// propia persona, así que se revalida todo server-side: el nombre/icono
// del item NUNCA se toma de lo que mande el cliente, se resuelve aquí a
// partir de itemId, igual que createListing/sendGift con el resto de
// campos del formulario.
export async function sendContactMessage(formData: FormData) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");
  const tField = await getTranslations("market.field");

  if (!(await isDmFeatureAvailable())) {
    throw new Error(t("dmNotAvailable"));
  }

  const sendContactMessageSchema = z.object({
    recipientId: z.string().min(1),
    itemId: z.string().min(1),
    // Opcional: no toda mención viene desde un listing (p.ej. Regalos no
    // tiene uno que enlazar) — ver comentario de listingId en UserMention.tsx.
    listingId: z.string().trim().min(1).optional(),
    message: z.string().trim().min(1, t("writeMessage")).max(500, t("maxCharacters")),
  });

  const parsed = sendContactMessageSchema.safeParse({
    recipientId: formData.get("recipientId"),
    itemId: formData.get("itemId"),
    listingId: formData.get("listingId") || undefined,
    message: formData.get("message"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? t("invalidData"));
  }
  if (parsed.data.recipientId === session.user.discordId) {
    throw new Error(t("cannotMessageSelf"));
  }

  const [recipient, item] = await Promise.all([
    prisma.user.findUnique({ where: { id: parsed.data.recipientId } }),
    prisma.item.findUnique({ where: { id: parsed.data.itemId } }),
  ]);
  if (!recipient) throw new Error(t("userNotFound"));
  if (!item) throw new Error(t("itemNotFound"));

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await sendDirectMessage(parsed.data.recipientId, {
    title: tDiscord("dm.contactMessage", { username: session.user.username, item: item.name }),
    url: parsed.data.listingId ? `${appUrl}/market/${parsed.data.listingId}` : undefined,
    color: DISCORD_EMBED_COLOR.MESSAGE,
    itemIconUrl: `${appUrl}${item.iconUrl}`,
    fields: [
      { name: tField("message"), value: parsed.data.message, inline: false },
      // Mención nativa de Discord: dentro del canal privado bot<->destinatario
      // no le hace ping a nadie (el remitente no está en ese canal), solo
      // renderiza un chip clicable que abre su perfil — desde ahí se puede
      // responder por DM sin salir de Discord.
      { name: tDiscord("fields.replyTo"), value: `<@${session.user.discordId}>`, inline: false },
    ],
  });
}
