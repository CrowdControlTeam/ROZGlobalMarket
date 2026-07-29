import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { formatPrice, priceColorClass } from "@/lib/price";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import {
  offerStatusLabel,
  listingTypeLabel,
  LISTING_TYPE_BADGE_CLASS,
  posterLabel,
  listingStatusLabel,
  formatOptionAmount,
} from "@/lib/market-labels";
import { labelClass } from "@/lib/ui";
import { UserMention } from "@/components/UserMention";
import { isDmFeatureAvailable } from "@/lib/discord-bot";
import { CancelListingButton } from "./[id]/CancelListingButton";
import { BuyForm } from "./[id]/BuyForm";
import { TradeOfferForm } from "./[id]/TradeOfferForm";
import { TradeOfferActions } from "./[id]/TradeOfferActions";

// Ficha de un listing — compartida entre la página completa
// (market/[id]/page.tsx, visita directa/enlace compartido) y el panel de
// detalle interceptado (market/@detail/(.)[id]/page.tsx), para no duplicar
// la lógica de precio/options/formularios de compra-oferta/cancelar. No
// incluye el <Panel> contenedor: cada sitio que la usa aporta el suyo (o,
// en el caso del panel, su propio fondo ya hace ese papel).
export async function ListingDetailContent({ id }: { id: string }) {
  const session = await requireSession();
  const t = await getTranslations("market");

  // dmAvailable no depende del listing (ni viceversa) — en paralelo en vez
  // de en serie.
  const [dmAvailable, listing] = await Promise.all([
    isDmFeatureAvailable(),
    prisma.listing.findUnique({
      where: { id },
      include: {
        item: true,
        poster: true,
        options: { include: { def: true }, orderBy: { slotIndex: "asc" } },
        deals: {
          include: { user: true, offeredItem: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ]);
  if (!listing) notFound();

  const isPoster = listing.posterId === session.user.discordId;
  const remaining = listing.quantity - listing.quantitySold;
  const isTrade = listing.type === "TRADE";
  const isBuy = listing.type === "BUY";
  const pendingOffers = listing.deals.filter((d) => d.status === "PENDING");
  const myOffers = listing.deals.filter((d) => d.userId === session.user.discordId);

  return (
    <>
      <div className="flex items-center gap-3">
        <Image
          src={listing.item.iconUrl}
          alt={listing.item.name}
          width={44}
          height={44}
        />
        <div className="min-w-0">
          {/* Badge en su propia línea arriba del nombre — con el badge
              inline, nombres un poco largos empujaban el badge o se
              descuadraban. */}
          <span
            className={`inline-block rounded border px-1.5 py-0.5 text-xs font-normal ${LISTING_TYPE_BADGE_CLASS[listing.type]}`}
          >
            {listingTypeLabel(t, listing.type)}
          </span>
          <h1 className="mt-1 font-heading text-sm text-ro-text">
            {formatItemDisplayName(listing.item.name, listing.refineLevel, listing.cardSlots)}
          </h1>
          <p className="mt-1 text-sm text-ro-text-muted">
            {listingStatusLabel(t, listing.status, listing.type)}
          </p>
        </div>
      </div>

      {/* Grid de 2 columnas en vez de filas apiladas con borde propio —
          reduce bastante el alto total, sobre todo en el panel móvil. */}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-ro-text-muted">{isBuy ? t("field.quantity") : t("detail.available")}</dt>
          <dd>{isBuy ? listing.quantity : remaining}</dd>
        </div>
        {!isTrade && listing.price !== null && (
          <div>
            <dt className="text-xs text-ro-text-muted">{isBuy ? t("field.payUpTo") : t("detail.unitPrice")}</dt>
            <dd className={`font-bold ${priceColorClass(listing.price)}`}>
              {formatPrice(listing.price)}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-ro-text-muted">{posterLabel(t, listing.type)}</dt>
          <dd>
            <UserMention
              userId={listing.posterId}
              username={listing.poster.username}
              viewerId={session.user.discordId}
              capitalize
              item={listing.item}
              listingId={listing.id}
              dmAvailable={dmAvailable}
            />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ro-text-muted">{t("detail.posted")}</dt>
          <dd>{listing.createdAt.toLocaleString()}</dd>
        </div>
        {/* Con 1 sola unidad, "Vendidos: 0 de 1" no aporta nada que
            "Disponibles" ya no diga. quantitySold no se usa en BUY. */}
        {!isBuy && listing.quantity > 1 && (
          <div>
            <dt className="text-xs text-ro-text-muted">{t("detail.sold")}</dt>
            <dd>
              {listing.quantitySold} {t("detail.of")} {listing.quantity}
            </dd>
          </div>
        )}
      </dl>

      {listing.options.length > 0 && (
        <div className="mt-2">
          <p className={labelClass}>{isBuy ? t("field.minStats") : t("field.options")}</p>
          {/* Texto plano en móvil (cabe en la mitad de columna sin
              apretarse); badge como en las cards del mercado a partir de
              sm, donde ya sobra sitio. */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:hidden">
            {listing.options.map((o) => (
              <div key={o.slotIndex} className="flex justify-between gap-2">
                <span className="text-ro-text-muted">{o.def.label}</span>
                <span className="font-semibold">{formatOptionAmount(o.value, isBuy)}</span>
              </div>
            ))}
          </div>
          <div className="hidden flex-wrap gap-1 sm:flex">
            {listing.options.map((o) => (
              <span
                key={o.slotIndex}
                className="rounded border border-ro-gold-dark/50 bg-ro-gold/10 px-1.5 py-0.5 text-xs text-ro-text-muted"
              >
                {o.def.label} {formatOptionAmount(o.value, isBuy)}
              </span>
            ))}
          </div>
        </div>
      )}

      {listing.status === "ACTIVE" && (
        <div className="mt-3">
          {isPoster ? (
            <CancelListingButton listingId={listing.id} showFulfill={isBuy} />
          ) : isTrade ? (
            <TradeOfferForm listingId={listing.id} />
          ) : listing.type === "SALE" && listing.price !== null ? (
            <BuyForm
              listingId={listing.id}
              remaining={remaining}
              unitPrice={listing.price}
            />
          ) : null}
        </div>
      )}

      {isTrade && (listing.status === "COMPLETED" || listing.status === "SOLD") && (
        <p className="mt-3 text-sm text-ro-text-muted">
          {(() => {
            const accepted = listing.deals.find((d) => d.status === "ACCEPTED");
            if (!accepted || !accepted.offeredItem) return null;
            return (
              <>
                {t("detail.tradedWith")}{" "}
                <UserMention
                  userId={accepted.userId}
                  username={accepted.user.username}
                  viewerId={session.user.discordId}
                  item={listing.item}
                  listingId={listing.id}
                  dmAvailable={dmAvailable}
                />{" "}
                {t("detail.forItem", {
                  item: formatItemDisplayName(
                    accepted.offeredItem.name,
                    accepted.offeredRefine ?? 0,
                    accepted.offeredCardSlots ?? 0,
                  ),
                })}
                {(accepted.offeredQuantity ?? 1) > 1 && ` x${accepted.offeredQuantity}`}
                {accepted.zenyOffered > 0 && ` + ${formatPrice(accepted.zenyOffered)}`}
              </>
            );
          })()}
        </p>
      )}

      {isTrade && (isPoster ? pendingOffers.length > 0 : myOffers.length > 0) && (
        <div className="mt-3">
          <p className={labelClass}>{isPoster ? t("detail.offersReceived") : t("detail.yourOffers")}</p>
          <ul className="mt-2 flex flex-col gap-3">
            {(isPoster ? pendingOffers : myOffers).map((offer) => (
              <li key={offer.id} className="rounded-md border-2 border-ro-panel-border/30 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {offer.offeredItem &&
                      formatItemDisplayName(
                        offer.offeredItem.name,
                        offer.offeredRefine ?? 0,
                        offer.offeredCardSlots ?? 0,
                      )}
                    {(offer.offeredQuantity ?? 1) > 1 && ` x${offer.offeredQuantity}`}
                  </span>
                  {!isPoster && (
                    <span className="text-xs text-ro-text-muted">
                      {offerStatusLabel(t, offer.status)}
                    </span>
                  )}
                </div>
                {isPoster && offer.offeredItem && (
                  <p className="mt-1 text-ro-text-muted">
                    {t("detail.offerFrom")}{" "}
                    <UserMention
                      userId={offer.userId}
                      username={offer.user.username}
                      viewerId={session.user.discordId}
                      item={offer.offeredItem}
                      listingId={listing.id}
                      dmAvailable={dmAvailable}
                    />
                  </p>
                )}
                {offer.zenyOffered > 0 && (
                  <p className="mt-1 text-ro-text-muted">+ {formatPrice(offer.zenyOffered)}</p>
                )}
                {offer.status === "PENDING" && (
                  <div className="mt-2">
                    <TradeOfferActions offerId={offer.id} role={isPoster ? "seller" : "offerer"} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
