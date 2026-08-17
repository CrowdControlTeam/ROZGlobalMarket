import { ItemIcon } from "@/components/ItemIcon";
import { ListingLink } from "@/components/ListingLink";
import type { ListingType } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { getMyPendingDeals } from "@/lib/listings";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { formatPrice } from "@/lib/price";
import { listingTypeLabel, LISTING_TYPE_BADGE_CLASS } from "@/lib/market-labels";
import { SaleReservationActions } from "@/app/market/[id]/SaleReservationActions";
import { BuyOfferActions } from "@/app/market/[id]/BuyOfferActions";
import { GiftClaimActions } from "@/app/market/[id]/GiftClaimActions";
import { TradeOfferActions } from "@/app/market/[id]/TradeOfferActions";

// Despacha a las acciones del flujo según el tipo de listing — reutiliza los
// mismos componentes que la ficha. `viewer` = si miro como poster (dueño del
// listing, confirma/rechaza) o como contraparte (el que ofertó, cancela).
function DealActions({
  dealId,
  type,
  viewer,
}: {
  dealId: string;
  type: ListingType;
  viewer: "poster" | "counterparty";
}) {
  switch (type) {
    case "SALE":
      return <SaleReservationActions dealId={dealId} role={viewer === "poster" ? "seller" : "buyer"} />;
    case "BUY":
      return <BuyOfferActions dealId={dealId} role={viewer === "poster" ? "buyer" : "seller"} />;
    case "GIFT":
      return <GiftClaimActions dealId={dealId} role={viewer === "poster" ? "giver" : "claimer"} />;
    case "TRADE":
      return <TradeOfferActions offerId={dealId} role={viewer === "poster" ? "seller" : "offerer"} />;
  }
}

// Resumen de lo que ofrece/pide el trato: en TRADE el item de contraoferta; en
// el resto, cantidad (+ total si hay precio).
function dealSummary(deal: {
  quantity: number;
  unitPrice: number | null;
  listing: { type: ListingType };
  offeredItem: { name: string; slotCount: number } | null;
  offeredQuantity: number | null;
  offeredRefine: number | null;
  zenyOffered: number;
}): string {
  if (deal.listing.type === "TRADE") {
    if (!deal.offeredItem) return "";
    const name = formatItemDisplayName(
      deal.offeredItem.name,
      deal.offeredRefine ?? 0,
      deal.offeredItem.slotCount,
    );
    const qty = (deal.offeredQuantity ?? 1) > 1 ? ` x${deal.offeredQuantity}` : "";
    const zeny = deal.zenyOffered > 0 ? ` + ${formatPrice(deal.zenyOffered)}` : "";
    return `${name}${qty}${zeny}`;
  }
  const price = deal.unitPrice ? ` · ${formatPrice(deal.quantity * deal.unitPrice)}` : "";
  return `x${deal.quantity}${price}`;
}

export default async function MyPendingPage() {
  const [{ incoming, outgoing }, t, tMine] = await Promise.all([
    getMyPendingDeals(),
    getTranslations("market"),
    getTranslations("myActivity"),
  ]);

  if (incoming.length === 0 && outgoing.length === 0) {
    return <p className="text-ro-text-light/70">{tMine("pendingEmpty")}</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {incoming.length > 0 && (
        <section>
          <h2 className="mb-3 font-heading text-sm text-ro-text">{tMine("pendingIncoming")}</h2>
          <ul className="flex flex-col gap-3">
            {incoming.map((deal) => (
              <li
                key={deal.id}
                className="flex items-center gap-4 rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 text-ro-text"
              >
                <ItemIcon item={deal.listing.item} width={40} height={40} />
                <div className="min-w-0 flex-1">
                  <ListingLink listingId={deal.listingId} className="flex items-center gap-2 font-semibold hover:text-ro-accent">
                    {formatItemDisplayName(deal.listing.item.name, deal.listing.refineLevel, deal.listing.item.slotCount)}
                    <span className={`rounded border px-1.5 py-0.5 text-xs font-normal ${LISTING_TYPE_BADGE_CLASS[deal.listing.type]}`}>
                      {listingTypeLabel(t, deal.listing.type)}
                    </span>
                  </ListingLink>
                  <p className="text-sm text-ro-text-muted">
                    {dealSummary(deal)} · @{deal.user.username}
                  </p>
                </div>
                <DealActions dealId={deal.id} type={deal.listing.type} viewer="poster" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <h2 className="mb-3 font-heading text-sm text-ro-text">{tMine("pendingOutgoing")}</h2>
          <ul className="flex flex-col gap-3">
            {outgoing.map((deal) => (
              <li
                key={deal.id}
                className="flex items-center gap-4 rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 text-ro-text"
              >
                <ItemIcon item={deal.listing.item} width={40} height={40} />
                <div className="min-w-0 flex-1">
                  <ListingLink listingId={deal.listingId} className="flex items-center gap-2 font-semibold hover:text-ro-accent">
                    {formatItemDisplayName(deal.listing.item.name, deal.listing.refineLevel, deal.listing.item.slotCount)}
                    <span className={`rounded border px-1.5 py-0.5 text-xs font-normal ${LISTING_TYPE_BADGE_CLASS[deal.listing.type]}`}>
                      {listingTypeLabel(t, deal.listing.type)}
                    </span>
                  </ListingLink>
                  <p className="text-sm text-ro-text-muted">
                    {dealSummary(deal)} · @{deal.listing.poster.username}
                  </p>
                </div>
                <DealActions dealId={deal.id} type={deal.listing.type} viewer="counterparty" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
