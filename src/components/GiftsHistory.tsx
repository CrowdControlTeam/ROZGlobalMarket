import Image from "next/image";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/guard";
import { getMyGifts } from "@/lib/gifts";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { UserMention } from "@/components/UserMention";
import { isDmFeatureAvailable } from "@/lib/discord-bot";
import { formatOptionAmount } from "@/lib/market-labels";

// Cuerpo de la lista de regalos enviados/recibidos (historial personal). Vive
// en /my/gifts (pestaña "Regalos" de "Mi actividad"). Es distinto del tipo
// Regalo del mercado unificado (?type=GIFT), que son listings reclamables.
export async function GiftsHistory() {
  // Ninguna depende del resultado de otra (getMyGifts vuelve a resolver la
  // sesión por su cuenta) — en paralelo en vez de en serie.
  const [session, gifts, dmAvailable, t] = await Promise.all([
    requireSession(),
    getMyGifts(),
    isDmFeatureAvailable(),
    getTranslations("market.gifts"),
  ]);

  if (gifts.length === 0) {
    return <p className="text-ro-text-light/70">{t("empty")}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {gifts.map((gift) => {
        const isSender = gift.senderId === session.user.discordId;
        return (
          <li
            key={gift.id}
            className="flex items-center gap-4 rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 text-ro-text"
          >
            {isSender ? (
              <ArrowUpRight
                className="shrink-0 text-ro-text-muted"
                size={20}
                aria-label={t("sentLabel")}
                role="img"
              >
                <title>{t("sentLabel")}</title>
              </ArrowUpRight>
            ) : (
              <ArrowDownLeft
                className="shrink-0 text-green-700"
                size={20}
                aria-label={t("receivedLabel")}
                role="img"
              >
                <title>{t("receivedLabel")}</title>
              </ArrowDownLeft>
            )}
            <Image src={gift.item.iconUrl} alt={gift.item.name} width={40} height={40} />
            <div className="flex-1">
              <p className="font-semibold">
                {formatItemDisplayName(gift.item.name, gift.refineLevel, gift.cardSlots)}
                {gift.quantity > 1 && ` x${gift.quantity}`}
              </p>
              {gift.options.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-1">
                  {gift.options.map((o) => (
                    <span
                      key={o.slotIndex}
                      className="rounded border border-ro-accent/30 bg-ro-accent/10 px-1.5 py-0.5 text-xs text-ro-accent"
                    >
                      {o.def.label} {formatOptionAmount(o.value, false)}
                    </span>
                  ))}
                </p>
              )}
              <p className="text-sm text-ro-text-muted">
                {isSender ? (
                  <>
                    {t("sentTo")}{" "}
                    <UserMention
                      userId={gift.recipientId}
                      username={gift.recipient.username}
                      viewerId={session.user.discordId}
                      item={gift.item}
                      dmAvailable={dmAvailable}
                    />
                  </>
                ) : (
                  <>
                    {t("receivedFrom")}{" "}
                    <UserMention
                      userId={gift.senderId}
                      username={gift.sender.username}
                      viewerId={session.user.discordId}
                      item={gift.item}
                      dmAvailable={dmAvailable}
                    />
                  </>
                )}
              </p>
            </div>
            <span className="text-xs text-ro-text-muted">{gift.createdAt.toLocaleDateString()}</span>
          </li>
        );
      })}
    </ul>
  );
}
