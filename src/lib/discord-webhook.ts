import { getTranslations } from "next-intl/server";
import { DISCORD_EMBED_COLOR } from "@/lib/discord-colors";
import { formatPrice } from "@/lib/price";
import { loadMarketConfig } from "@/lib/market-config";
import { formatOptionAmount } from "@/lib/market-labels";

type ListingWebhookPayload = {
  itemName: string;
  itemIconUrl: string; // absoluta
  type: "SALE" | "TRADE" | "BUY";
  price: number | null; // null cuando type = TRADE; en BUY es el precio máximo a pagar
  quantity: number;
  posterUsername: string;
  posterAvatarUrl: string | null;
  listingUrl: string; // absoluta
  options?: { label: string; value: number }[];
};

export async function sendListingCreatedWebhook(payload: ListingWebhookPayload) {
  const config = await loadMarketConfig();
  // Configurable desde /admin en vez de una variable de entorno — hace
  // falta URL Y el toggle activo, si falta cualquiera de los dos no se
  // manda nada (ver src/lib/market-config.ts).
  if (!config.webhookEnabled || !config.webhookUrl) return;
  const webhookUrl = config.webhookUrl;

  const t = await getTranslations("discord");
  const tField = await getTranslations("market.field");

  const body = {
    embeds: [
      {
        title: `${t(`listingTitle.${payload.type}`)}: ${payload.itemName}`,
        url: payload.listingUrl,
        color: DISCORD_EMBED_COLOR[payload.type],
        thumbnail: { url: payload.itemIconUrl },
        author: {
          name: payload.posterUsername,
          icon_url: payload.posterAvatarUrl ?? undefined,
        },
        fields: [
          ...(payload.type === "TRADE"
            ? []
            : [
                {
                  name: payload.type === "BUY" ? tField("payUpTo") : t("fields.price"),
                  value: formatPrice(payload.price!),
                  inline: true,
                },
              ]),
          { name: tField("quantity"), value: String(payload.quantity), inline: true },
          ...(payload.options && payload.options.length > 0
            ? [
                {
                  name: tField("options"),
                  value: payload.options
                    .map((o) => `${o.label}: ${formatOptionAmount(o.value, payload.type === "BUY")}`)
                    .join("\n"),
                  inline: false,
                },
              ]
            : []),
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  await postWebhook(webhookUrl, body);
}

// Un fallo aquí nunca debe tumbar la publicación en sí (ya se guardó en la
// DB): se registra el error y ya está, sin reintentos.
async function postWebhook(webhookUrl: string, body: unknown) {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(
        `Webhook de Discord respondió ${res.status}: ${await res.text()}`,
      );
    }
  } catch (err) {
    console.error("Error enviando webhook de Discord:", err);
  }
}
