"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { loadMoreListings } from "@/lib/market-actions";
import type { MarketFilters } from "@/lib/market";
import { buttonClass } from "@/lib/ui";
import { formatPrice, priceColorClass } from "@/lib/price";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { listingTypeLabel, LISTING_TYPE_BADGE_CLASS, formatOptionAmount } from "@/lib/market-labels";
import { getErrorMessage } from "@/lib/errors";
import { UserMention } from "@/components/UserMention";

type Item = { id: string; name: string; iconUrl: string };
type Poster = { id: string; username: string };
type ListingOption = { slotIndex: number; value: number; def: { label: string } };
type Listing = {
  id: string;
  type: "SALE" | "TRADE" | "BUY";
  quantity: number;
  quantitySold: number;
  price: number | null;
  refineLevel: number;
  cardSlots: number;
  item: Item;
  poster: Poster;
  options: ListingOption[];
};

export function MarketResults({
  initialListings,
  initialCursor,
  filters,
  currentUserId,
  dmAvailable = false,
}: {
  initialListings: Listing[];
  initialCursor: string | null;
  filters: Omit<MarketFilters, "cursor">;
  currentUserId: string;
  dmAvailable?: boolean;
}) {
  const [listings, setListings] = useState(initialListings);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("market");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Abre el detalle como panel superpuesto (?listing=<id>) en vez de
  // navegar a /market/[id] — así el mercado se queda montado detrás. La
  // página /market/[id] se conserva aparte para enlaces directos/compartidos.
  function listingHref(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("listing", id);
    return `${pathname}?${params.toString()}`;
  }

  function loadMore() {
    setLoadMoreError(null);
    startTransition(async () => {
      if (!cursor) return;
      try {
        const result = await loadMoreListings({ ...filters, cursor });
        setListings((prev) => [...prev, ...result.listings]);
        setCursor(result.nextCursor);
      } catch (err) {
        setLoadMoreError(getErrorMessage(err, t("results.loadMoreError")));
      }
    });
  }

  if (listings.length === 0) {
    return (
      <p className="text-ro-text-light/70">
        {t("results.empty")}
      </p>
    );
  }

  return (
    <div>
      <ul className="flex flex-col gap-3">
        {listings.map((listing) => {
          const badge = !filters.type && (
            <span
              className={`self-start rounded border px-1.5 py-0.5 text-xs font-normal ${LISTING_TYPE_BADGE_CLASS[listing.type]}`}
            >
              {listingTypeLabel(t, listing.type)}
            </span>
          );
          const posterLine = (
            <p className="text-sm text-ro-text-muted">
              {listing.type !== "BUY" &&
                `${t("results.available", { count: listing.quantity - listing.quantitySold })} · `}
              {listing.type === "BUY" ? t("results.wantedBy") : t("results.soldBy")}{" "}
              <UserMention
                userId={listing.poster.id}
                username={listing.poster.username}
                viewerId={currentUserId}
                item={listing.item}
                listingId={listing.id}
                dmAvailable={dmAvailable}
              />
            </p>
          );
          const priceLine = listing.type !== "TRADE" && listing.price !== null && (
            <p className={`font-bold ${priceColorClass(listing.price)}`}>
              {listing.type === "BUY" ? t("results.upTo") : ""}
              {formatPrice(listing.price)}
            </p>
          );

          return (
            <li key={listing.id}>
              {/* Fila horizontal (icono | contenido | precio) — cómoda en
                  desktop, pero en móvil las options envueltas junto al
                  precio a la derecha hacían que cada card se viera distinta
                  según cuánto contenido tuviera. En su lugar, en móvil todo
                  se apila en una columna con las options a ancho completo
                  (ver bloque siguiente). */}
              <Link
                href={listingHref(listing.id)}
                scroll={false}
                className="hidden items-center gap-4 rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 text-ro-text transition-colors hover:border-ro-gold sm:flex"
              >
                <Image
                  src={listing.item.iconUrl}
                  alt={listing.item.name}
                  width={40}
                  height={40}
                />
                <div className="flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {formatItemDisplayName(listing.item.name, listing.refineLevel, listing.cardSlots)}
                    {badge}
                  </p>
                  {posterLine}
                  {listing.options.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {listing.options.map((o) => (
                        <span
                          key={o.slotIndex}
                          className="rounded border border-ro-gold-dark/50 bg-ro-gold/10 px-1.5 py-0.5 text-xs text-ro-text-muted"
                        >
                          {o.def.label} {formatOptionAmount(o.value, listing.type === "BUY")}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                {priceLine}
              </Link>

              {/* Tarjeta apilada, solo en móvil. */}
              <Link
                href={listingHref(listing.id)}
                scroll={false}
                className="flex flex-col gap-2 rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 text-ro-text transition-colors hover:border-ro-gold sm:hidden"
              >
                {badge}
                <div className="flex items-center gap-3">
                  <Image
                    src={listing.item.iconUrl}
                    alt={listing.item.name}
                    width={40}
                    height={40}
                  />
                  <p className="flex-1 font-semibold">
                    {formatItemDisplayName(listing.item.name, listing.refineLevel, listing.cardSlots)}
                  </p>
                </div>
                {posterLine}
                {listing.options.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {listing.options.map((o) => (
                      <div
                        key={o.slotIndex}
                        className="rounded border border-ro-gold-dark/50 bg-ro-gold/10 px-2 py-1.5 text-sm text-ro-text-muted"
                      >
                        {o.def.label} {formatOptionAmount(o.value, listing.type === "BUY")}
                      </div>
                    ))}
                  </div>
                )}
                {priceLine}
              </Link>
            </li>
          );
        })}
      </ul>

      {loadMoreError && <p className="mt-4 text-sm text-red-700">{loadMoreError}</p>}
      {cursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isPending}
          className={`mt-4 w-full ${buttonClass("secondary")}`}
        >
          {isPending ? tCommon("loading") : t("results.loadMore")}
        </button>
      )}
    </div>
  );
}
