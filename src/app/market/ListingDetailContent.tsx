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
import { availableFrom } from "@/lib/deals";
import { UserMention } from "@/components/UserMention";
import { isDmFeatureAvailable } from "@/lib/discord-bot";
import { CancelListingButton } from "./[id]/CancelListingButton";
import { ReserveForm } from "./[id]/ReserveForm";
import { SaleReservationActions } from "./[id]/SaleReservationActions";
import { OfferToFulfillForm } from "./[id]/OfferToFulfillForm";
import { BuyOfferActions } from "./[id]/BuyOfferActions";
import { ClaimGiftForm } from "./[id]/ClaimGiftForm";
import { GiftClaimActions } from "./[id]/GiftClaimActions";
import { TradeOfferForm } from "./[id]/TradeOfferForm";
import { TradeOfferActions } from "./[id]/TradeOfferActions";

// Cantidad para mostrar: ∞ cuando es ilimitada (null, "los que tengas").
function fmtQty(n: number | null): string {
  return n === null ? "∞" : String(n);
}

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
  // Vendido/entregado = Σ cantidad de los Deal ACCEPTED (ya no hay contador
  // quantitySold; todo se deriva de los Deal — ver deals.ts).
  const sold = listing.deals
    .filter((d) => d.status === "ACCEPTED")
    .reduce((s, d) => s + d.quantity, 0);
  // null = ilimitado ("los que tengas", solo SALE/BUY): sin resto que mostrar.
  const remaining = listing.quantity === null ? null : listing.quantity - sold;
  const isTrade = listing.type === "TRADE";
  const isBuy = listing.type === "BUY";
  const isSale = listing.type === "SALE";
  const isGift = listing.type === "GIFT";
  // "Sin precio" (competitivo): un SALE/BUY sin precio fijo. La contraparte puja
  // su unitPrice y el poster elige la mejor; a diferencia de la reserva/oferta a
  // precio fijo, las PENDING NO retienen stock (ver reserveListing/offerToFulfill).
  const isCompetitive = (isSale || isBuy) && listing.price === null;
  // Los Deal PENDING retienen cupo SOLO en los modos de reserva (precio fijo y
  // regalo); en competitivo compiten por las mismas unidades y no bloquean, así
  // que ahí no se restan de lo disponible.
  const reserved =
    (isSale || isBuy || isGift) && !isCompetitive
      ? listing.deals.filter((d) => d.status === "PENDING").reduce((s, d) => s + d.quantity, 0)
      : 0;
  const available = availableFrom(listing.quantity, sold, reserved);
  const pendingOffers = listing.deals.filter((d) => d.status === "PENDING");
  const myOffers = listing.deals.filter((d) => d.userId === session.user.discordId);
  // En competitivo, el poster compara pujas: se ordenan por mejor precio/ud
  // (venta = más alto primero; compra = más bajo primero). Copia para no mutar.
  const pendingByBestPrice = [...pendingOffers].sort((a, b) => {
    const pa = a.unitPrice ?? 0;
    const pb = b.unitPrice ?? 0;
    return isBuy ? pa - pb : pb - pa;
  });

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
          <dd>{fmtQty(isBuy ? listing.quantity : isSale || isGift ? available : remaining)}</dd>
        </div>
        {!isTrade && listing.price !== null && (
          <div>
            <dt className="text-xs text-ro-text-muted">{isBuy ? t("field.payUpTo") : t("detail.unitPrice")}</dt>
            <dd className={`font-bold ${priceColorClass(listing.price)}`}>
              {formatPrice(listing.price)}
            </dd>
          </div>
        )}
        {isCompetitive && (
          <div>
            <dt className="text-xs text-ro-text-muted">{isBuy ? t("field.payUpTo") : t("detail.unitPrice")}</dt>
            <dd className="font-bold text-ro-text-muted">
              {isBuy ? t("field.bestPrice") : t("field.bestOffer")}
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
        {!isBuy && (listing.quantity === null || listing.quantity > 1) && (
          <div>
            <dt className="text-xs text-ro-text-muted">
              {isGift ? t("detail.given") : t("detail.sold")}
            </dt>
            {/* Ilimitado (quantity null): "0 de ∞" no aporta —el tope no existe—,
                así que se muestra solo lo vendido. */}
            <dd>
              {listing.quantity === null
                ? sold
                : `${sold} ${t("detail.of")} ${listing.quantity}`}
            </dd>
          </div>
        )}
        {isSale && reserved > 0 && (
          <div>
            <dt className="text-xs text-ro-text-muted">{t("detail.reserved")}</dt>
            <dd>{reserved}</dd>
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
          ) : isSale && (available === null || available > 0) ? (
            // unitPrice null (sin precio) => ReserveForm muestra el input de puja.
            <ReserveForm
              listingId={listing.id}
              available={available}
              unitPrice={listing.price}
            />
          ) : isBuy && (available === null || available > 0) ? (
            <OfferToFulfillForm
              listingId={listing.id}
              available={available}
              unitPrice={listing.price}
            />
          ) : isGift && (available === null || available > 0) ? (
            <ClaimGiftForm listingId={listing.id} available={available} />
          ) : null}
        </div>
      )}

      {isTrade && listing.status === "COMPLETED" && (
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

      {isSale && (isPoster ? pendingOffers.length > 0 : myOffers.length > 0) && (
        <div className="mt-3">
          <p className={labelClass}>
            {isCompetitive
              ? isPoster
                ? t("detail.offersReceived")
                : t("detail.yourOffers")
              : isPoster
                ? t("detail.reservationsReceived")
                : t("detail.yourReservations")}
          </p>
          <ul className="mt-2 flex flex-col gap-3">
            {(isPoster ? pendingByBestPrice : myOffers).map((deal) => (
              <li key={deal.id} className="rounded-md border-2 border-ro-panel-border/30 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    x{deal.quantity}
                    <span className="ml-1 font-normal text-ro-text-muted">
                      {isCompetitive
                        ? ` · ${formatPrice(deal.unitPrice ?? 0)}${t("detail.perUnit")} (${formatPrice(
                            deal.quantity * (deal.unitPrice ?? 0),
                          )})`
                        : ` · ${formatPrice(deal.quantity * (deal.unitPrice ?? 0))}`}
                    </span>
                  </span>
                  {!isPoster && (
                    <span className="text-xs text-ro-text-muted">{offerStatusLabel(t, deal.status)}</span>
                  )}
                </div>
                {isPoster && (
                  <p className="mt-1 text-ro-text-muted">
                    {t("detail.reservedBy")}{" "}
                    <UserMention
                      userId={deal.userId}
                      username={deal.user.username}
                      viewerId={session.user.discordId}
                      item={listing.item}
                      listingId={listing.id}
                      dmAvailable={dmAvailable}
                    />
                  </p>
                )}
                {deal.status === "PENDING" && (
                  <div className="mt-2">
                    <SaleReservationActions dealId={deal.id} role={isPoster ? "seller" : "buyer"} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isBuy && (isPoster ? pendingOffers.length > 0 : myOffers.length > 0) && (
        <div className="mt-3">
          <p className={labelClass}>
            {isCompetitive
              ? isPoster
                ? t("detail.offersReceived")
                : t("detail.yourOffers")
              : isPoster
                ? t("detail.fulfillOffersReceived")
                : t("detail.yourFulfillOffers")}
          </p>
          <ul className="mt-2 flex flex-col gap-3">
            {(isPoster ? pendingByBestPrice : myOffers).map((deal) => (
              <li key={deal.id} className="rounded-md border-2 border-ro-panel-border/30 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    x{deal.quantity}
                    <span className="ml-1 font-normal text-ro-text-muted">
                      {isCompetitive
                        ? ` · ${formatPrice(deal.unitPrice ?? 0)}${t("detail.perUnit")} (${formatPrice(
                            deal.quantity * (deal.unitPrice ?? 0),
                          )})`
                        : ` · ${formatPrice(deal.quantity * (deal.unitPrice ?? 0))}`}
                    </span>
                  </span>
                  {!isPoster && (
                    <span className="text-xs text-ro-text-muted">{offerStatusLabel(t, deal.status)}</span>
                  )}
                </div>
                {isPoster && (
                  <p className="mt-1 text-ro-text-muted">
                    {t("detail.offeredBy")}{" "}
                    <UserMention
                      userId={deal.userId}
                      username={deal.user.username}
                      viewerId={session.user.discordId}
                      item={listing.item}
                      listingId={listing.id}
                      dmAvailable={dmAvailable}
                    />
                  </p>
                )}
                {deal.status === "PENDING" && (
                  <div className="mt-2">
                    <BuyOfferActions dealId={deal.id} role={isPoster ? "buyer" : "seller"} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isGift && (isPoster ? pendingOffers.length > 0 : myOffers.length > 0) && (
        <div className="mt-3">
          <p className={labelClass}>
            {isPoster ? t("detail.claimsReceived") : t("detail.yourClaims")}
          </p>
          <ul className="mt-2 flex flex-col gap-3">
            {(isPoster ? pendingOffers : myOffers).map((deal) => (
              <li key={deal.id} className="rounded-md border-2 border-ro-panel-border/30 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">x{deal.quantity}</span>
                  {!isPoster && (
                    <span className="text-xs text-ro-text-muted">{offerStatusLabel(t, deal.status)}</span>
                  )}
                </div>
                {isPoster && (
                  <p className="mt-1 text-ro-text-muted">
                    {t("detail.claimedBy")}{" "}
                    <UserMention
                      userId={deal.userId}
                      username={deal.user.username}
                      viewerId={session.user.discordId}
                      item={listing.item}
                      listingId={listing.id}
                      dmAvailable={dmAvailable}
                    />
                  </p>
                )}
                {deal.status === "PENDING" && (
                  <div className="mt-2">
                    <GiftClaimActions dealId={deal.id} role={isPoster ? "giver" : "claimer"} />
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
