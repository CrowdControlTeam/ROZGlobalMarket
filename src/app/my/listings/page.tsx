import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { getMyListings } from "@/lib/listings";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { formatPrice, priceColorClass } from "@/lib/price";
import {
  listingTypeLabel,
  listingStatusLabel,
  LISTING_TYPE_BADGE_CLASS,
  formatOptionAmount,
} from "@/lib/market-labels";

export default async function MyListingsPage() {
  const listings = await getMyListings();
  const t = await getTranslations("market");
  const tMine = await getTranslations("myActivity");

  if (listings.length === 0) {
    return <p className="text-ro-text-light/70">{tMine("listingsEmpty")}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {listings.map((listing) => {
        const remaining = listing.quantity - listing.quantitySold;
        const isBuy = listing.type === "BUY";
        return (
          <li key={listing.id}>
            <Link
              href={`/market/${listing.id}`}
              className="flex items-center gap-4 rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 text-ro-text transition-colors hover:border-ro-gold"
            >
              <Image src={listing.item.iconUrl} alt={listing.item.name} width={40} height={40} />
              <div className="flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  {formatItemDisplayName(listing.item.name, listing.refineLevel, listing.cardSlots)}
                  <span
                    className={`rounded border px-1.5 py-0.5 text-xs font-normal ${LISTING_TYPE_BADGE_CLASS[listing.type]}`}
                  >
                    {listingTypeLabel(t, listing.type)}
                  </span>
                </p>
                <p className="text-sm text-ro-text-muted">
                  {listingStatusLabel(t, listing.status, listing.type)}
                  {!isBuy && listing.status === "ACTIVE" && listing.quantity > 1 &&
                    ` · ${t("results.available", { count: remaining })}`}
                </p>
                {listing.options.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {listing.options.map((o) => (
                      <span
                        key={o.slotIndex}
                        className="rounded border border-ro-gold-dark/50 bg-ro-gold/10 px-1.5 py-0.5 text-xs text-ro-text-muted"
                      >
                        {o.def.label} {formatOptionAmount(o.value, isBuy)}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              {listing.type !== "TRADE" && listing.price !== null && (
                <p className={`font-bold ${priceColorClass(listing.price)}`}>
                  {isBuy ? t("results.upTo") : ""}
                  {formatPrice(listing.price)}
                </p>
              )}
              <span className="text-xs text-ro-text-muted">
                {listing.createdAt.toLocaleDateString()}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
