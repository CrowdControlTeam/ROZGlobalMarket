import { ItemIcon } from "@/components/ItemIcon";
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
  listingStatusLabel,
  formatOptionAmount,
} from "@/lib/market-labels";
import { labelClass } from "@/lib/ui";
import { availableFrom } from "@/lib/deals";
import { UserMention } from "@/components/UserMention";
import { isDmFeatureAvailable } from "@/lib/discord-bot";
import { CancelListingButton } from "./[id]/CancelListingButton";
import { EditListingButton } from "./[id]/EditListingButton";
import { RepostListingButton } from "./[id]/RepostListingButton";
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

// Precio con formato de miles y color por tramo (ver priceColorClass). Se usa
// en las líneas secundarias de las ofertas/reservas para que, aunque el texto
// que las rodea sea muted, el importe conserve su color de tramo.
function Price({ value }: { value: number }) {
  return <span className={priceColorClass(value)}>{formatPrice(value)}</span>;
}

// Fila clave→valor de la ficha (etiqueta a la izquierda, valor a la derecha).
function KvRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-1.5 ${last ? "" : "border-b border-ro-panel-border/60"}`}
    >
      <dt className="text-ro-text-muted">{label}</dt>
      <dd className="text-right font-medium text-ro-text">{value}</dd>
    </div>
  );
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
      // `select` en las relaciones pesadas (item/offeredItem) para no traer la
      // fila completa de Item (description[]/restrictions). Los escalares de
      // Listing/Deal van con el include; def es pequeño.
      include: {
        item: { select: { id: true, name: true, iconUrl: true, slotCount: true } },
        poster: { select: { id: true, username: true } },
        options: { include: { def: true }, orderBy: { slotIndex: "asc" } },
        deals: {
          include: {
            user: { select: { id: true, username: true } },
            offeredItem: { select: { id: true, name: true, iconUrl: true, slotCount: true } },
          },
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
  // Editable = del usuario y SIN deals vivos (PENDING/ACCEPTED); misma regla que
  // la card del mercado y updateListing. CANCELLED/REJECTED no cuentan.
  const hasLiveDeals = listing.deals.some((d) => d.status === "PENDING" || d.status === "ACCEPTED");
  const myOffers = listing.deals.filter((d) => d.userId === session.user.discordId);
  // En competitivo, el poster compara pujas: se ordenan por mejor precio/ud
  // (venta = más alto primero; compra = más bajo primero). Copia para no mutar.
  const pendingByBestPrice = [...pendingOffers].sort((a, b) => {
    const pa = a.unitPrice ?? 0;
    const pb = b.unitPrice ?? 0;
    return isBuy ? pa - pb : pb - pa;
  });
  // Precio sugerido al pujar/ofertar en competitivo = la mejor oferta actual (la
  // primera ya ordenada); null si aún no hay ninguna (el form arranca en 1).
  const bestOfferPrice = isCompetitive ? (pendingByBestPrice[0]?.unitPrice ?? null) : null;

  return (
    <>
      {/* Hero: icono grande + nombre + badge · vendedor. */}
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-ro-panel-border bg-ro-panel-alt">
          <ItemIcon
            item={listing.item}
            width={44}
            height={44}
            refine={listing.refineLevel}
            options={listing.options.map((o) => `${o.def.label} ${formatOptionAmount(o.value, isBuy)}`)}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-extrabold text-ro-text">
            {formatItemDisplayName(listing.item.name, listing.refineLevel, listing.item.slotCount)}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ro-text-muted">
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide ${LISTING_TYPE_BADGE_CLASS[listing.type]}`}
            >
              {listingTypeLabel(t, listing.type)}
            </span>
            <span>
              ·{" "}
              <UserMention
                userId={listing.posterId}
                username={listing.poster.username}
                viewerId={session.user.discordId}
                capitalize
                item={listing.item}
                listingId={listing.id}
                dmAvailable={dmAvailable}
              />
            </span>
          </p>
        </div>
      </div>

      {/* Precio grande (color por tramo/tipo). */}
      <div className="mt-3 text-xl font-extrabold">
        {isTrade ? (
          <span className="text-ro-type-trade">{listingTypeLabel(t, "TRADE")}</span>
        ) : isGift ? (
          <span className="text-ro-type-buy">{t("results.free")}</span>
        ) : isCompetitive ? (
          <span className="text-base font-bold text-ro-text-muted">
            {isBuy ? t("field.bestPrice") : t("field.bestOffer")}
          </span>
        ) : (
          <span className={priceColorClass(listing.price ?? 0)}>
            {formatPrice(listing.price ?? 0)}
            {isBuy && <span className="ml-1 text-xs font-normal text-ro-text-muted">{t("detail.perUnit")}</span>}
          </span>
        )}
      </div>
      {listing.status !== "ACTIVE" && (
        <p className="mt-1 text-sm text-ro-text-muted">{listingStatusLabel(t, listing.status, listing.type)}</p>
      )}

      {/* Datos clave, en filas clave→valor. */}
      <dl className="mt-3 flex flex-col text-sm">
        <KvRow
          label={isBuy ? t("field.quantity") : t("detail.available")}
          value={fmtQty(isBuy ? listing.quantity : isSale || isGift ? available : remaining)}
        />
        {/* Refino y slots no se listan aquí: ya salen en el nombre del item
            (formatItemDisplayName → "+9 Nombre [2]"), sería redundante. */}
        {/* Con 1 sola unidad, "Vendidos: 0 de 1" no aporta nada. No aplica a BUY. */}
        {!isBuy && (listing.quantity === null || listing.quantity > 1) && (
          <KvRow
            label={isGift ? t("detail.given") : t("detail.sold")}
            value={listing.quantity === null ? String(sold) : `${sold} ${t("detail.of")} ${listing.quantity}`}
          />
        )}
        {isSale && reserved > 0 && <KvRow label={t("detail.reserved")} value={String(reserved)} />}
        <KvRow label={t("detail.posted")} value={listing.createdAt.toLocaleString()} last />
      </dl>

      {listing.options.length > 0 && (
        <div className="mt-3">
          <p className={labelClass}>{isBuy ? t("field.minStats") : t("field.options")}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {listing.options.map((o) => (
              <span
                key={o.slotIndex}
                className="rounded border border-ro-accent/30 bg-ro-accent/10 px-1.5 py-0.5 text-xs text-ro-accent"
              >
                {o.def.label} {formatOptionAmount(o.value, isBuy)}
              </span>
            ))}
          </div>
        </div>
      )}

      {listing.notes && (
        <div className="mt-3">
          <p className={labelClass}>{t("field.notes")}</p>
          {/* whitespace-pre-wrap: conserva los saltos de línea que escribió el
              poster; break-words evita que un texto largo sin espacios desborde. */}
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ro-text">{listing.notes}</p>
        </div>
      )}

      {listing.status === "ACTIVE" && (
        <div className="mt-3">
          {isPoster ? (
            // Cancelar primero (siempre visible para el poster) y Editar en la
            // misma línea; los mensajes del cancelar caen debajo (order-last).
            <div className="flex flex-wrap items-center gap-2">
              <CancelListingButton
                listingId={listing.id}
                unlimited={listing.quantity === null}
                hasPendingOffers={pendingOffers.length > 0}
              />
              <EditListingButton listingId={listing.id} canEdit={!hasLiveDeals} />
            </div>
          ) : isTrade ? (
            <TradeOfferForm listingId={listing.id} />
          ) : isSale && (available === null || available > 0) ? (
            // unitPrice null (sin precio) => ReserveForm muestra el input de puja.
            // key por available+mejor oferta: al comprar y refrescar, el form se
            // remonta y la cantidad/puja vuelven al nuevo máximo/sugerido (2A).
            <ReserveForm
              key={`reserve-${available}-${bestOfferPrice}`}
              listingId={listing.id}
              available={available}
              unitPrice={listing.price}
              suggestedBid={bestOfferPrice}
            />
          ) : isBuy && (available === null || available > 0) ? (
            <OfferToFulfillForm
              key={`fulfill-${available}-${bestOfferPrice}`}
              listingId={listing.id}
              available={available}
              unitPrice={listing.price}
              suggestedAsk={bestOfferPrice}
            />
          ) : isGift && (available === null || available > 0) ? (
            <ClaimGiftForm listingId={listing.id} available={available} />
          ) : null}
        </div>
      )}

      {/* Publicación NO activa (cerrada/cancelada/expirada) del propio poster:
          "Republicar" para crear una nueva con los datos precargados. */}
      {isPoster && listing.status !== "ACTIVE" && (
        <div className="mt-3">
          <RepostListingButton listingId={listing.id} />
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
                    accepted.offeredItem?.slotCount ?? 0,
                  ),
                })}
                {(accepted.offeredQuantity ?? 1) > 1 && ` x${accepted.offeredQuantity}`}
                {accepted.zenyOffered > 0 && (
                  <>
                    {" + "}
                    <Price value={accepted.zenyOffered} />
                  </>
                )}
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
              <li key={offer.id} className="rounded-lg border border-ro-panel-border bg-ro-panel-alt p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {offer.offeredItem &&
                      formatItemDisplayName(
                        offer.offeredItem.name,
                        offer.offeredRefine ?? 0,
                        offer.offeredItem?.slotCount ?? 0,
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
                  <p className="mt-1 text-ro-text-muted">
                    + <Price value={offer.zenyOffered} />
                  </p>
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
              <li key={deal.id} className="rounded-lg border border-ro-panel-border bg-ro-panel-alt p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    x{deal.quantity}
                    <span className="ml-1 font-normal text-ro-text-muted">
                      {isCompetitive ? (
                        <>
                          {" · "}
                          <Price value={deal.unitPrice ?? 0} />
                          {t("detail.perUnit")} (<Price value={deal.quantity * (deal.unitPrice ?? 0)} />)
                        </>
                      ) : (
                        <>
                          {" · "}
                          <Price value={deal.quantity * (deal.unitPrice ?? 0)} />
                        </>
                      )}
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
              <li key={deal.id} className="rounded-lg border border-ro-panel-border bg-ro-panel-alt p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    x{deal.quantity}
                    <span className="ml-1 font-normal text-ro-text-muted">
                      {isCompetitive ? (
                        <>
                          {" · "}
                          <Price value={deal.unitPrice ?? 0} />
                          {t("detail.perUnit")} (<Price value={deal.quantity * (deal.unitPrice ?? 0)} />)
                        </>
                      ) : (
                        <>
                          {" · "}
                          <Price value={deal.quantity * (deal.unitPrice ?? 0)} />
                        </>
                      )}
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
              <li key={deal.id} className="rounded-lg border border-ro-panel-border bg-ro-panel-alt p-3 text-sm">
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
