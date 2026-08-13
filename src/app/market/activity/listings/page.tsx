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
import { ListingStatusFilter } from "@/components/ListingStatusFilter";

export default async function MyListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ active?: string; inactive?: string }>;
}) {
  const [listings, params] = await Promise.all([getMyListings(), searchParams]);
  const t = await getTranslations("market");
  const tMine = await getTranslations("myActivity");

  if (listings.length === 0) {
    return <p className="text-ro-text-light/70">{tMine("listingsEmpty")}</p>;
  }

  // Filtro por estado: "activo" = ACTIVE; "no activo" = el resto (cerrada,
  // cancelada, expirada). Sin parámetro = ambos visibles (se muestran todos).
  const showActive = params.active !== "0";
  const showInactive = params.inactive !== "0";
  const filtered = listings.filter((l) =>
    l.status === "ACTIVE" ? showActive : showInactive,
  );

  return (
    <>
      <ListingStatusFilter />
      {filtered.length === 0 ? (
        <p className="text-ro-text-light/70">{tMine("listingsNoneMatch")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((listing) => {
        const isBuy = listing.type === "BUY";
        return (
          <li key={listing.id}>
            <Link
              href={`/market/${listing.id}`}
              className="flex items-center gap-4 rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 text-ro-text transition-colors hover:border-ro-accent"
            >
              <Image src={listing.item.iconUrl} alt={listing.item.name} width={40} height={40} />
              <div className="flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  {formatItemDisplayName(listing.item.name, listing.refineLevel, listing.item.slotCount)}
                  <span
                    className={`rounded border px-1.5 py-0.5 text-xs font-normal ${LISTING_TYPE_BADGE_CLASS[listing.type]}`}
                  >
                    {listingTypeLabel(t, listing.type)}
                  </span>
                </p>
                <p className="text-sm text-ro-text-muted">
                  {listingStatusLabel(t, listing.status, listing.type)}
                  {/* Cantidad también en las compras (unidades que aún se buscan),
                      igual que el grid del mercado: "x{n}" en compra, "x{n}
                      disponibles" en el resto, "∞" si es ilimitada. */}
                  {listing.status === "ACTIVE" && listing.quantity === null &&
                    ` · ${t("results.availableUnlimited")}`}
                  {listing.status === "ACTIVE" && listing.quantity !== null && listing.quantity > 1 &&
                    ` · ${
                      isBuy
                        ? t("results.wanted", { count: listing.quantity - listing.sold })
                        : t("results.available", { count: listing.quantity - listing.sold })
                    }`}
                </p>
                {listing.options.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {listing.options.map((o) => (
                      <span
                        key={o.slotIndex}
                        className="rounded border border-ro-accent/30 bg-ro-accent/10 px-1.5 py-0.5 text-xs text-ro-accent"
                      >
                        {o.def.label} {formatOptionAmount(o.value, isBuy)}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              {listing.type !== "TRADE" && listing.price !== null && (
                <p className={`font-bold ${priceColorClass(listing.price)}`}>
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
      )}
    </>
  );
}
