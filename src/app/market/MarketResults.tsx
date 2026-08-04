"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutGrid, List as ListIcon } from "lucide-react";
import { loadMoreListings } from "@/lib/market-actions";
import type { MarketFilters } from "@/lib/market";
import { buttonClass } from "@/lib/ui";
import { formatPrice, priceColorClass } from "@/lib/price";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { listingTypeLabel, LISTING_TYPE_BADGE_CLASS, formatOptionAmount } from "@/lib/market-labels";
import { getErrorMessage } from "@/lib/errors";
import { UserMention } from "@/components/UserMention";
import { SortSelect } from "./SortSelect";
import { useListingPatches, clearListingPatches } from "./listingStore";
import type { ListingCardPatch } from "@/lib/listing-card";

type Item = { id: string; name: string; iconUrl: string };
type Poster = { id: string; username: string };
type ListingOption = { slotIndex: number; value: number; def: { label: string } };
type Listing = {
  id: string;
  type: "SALE" | "TRADE" | "BUY" | "GIFT";
  quantity: number | null; // null = ilimitado ("los que tengas")
  sold: number;
  reserved: number; // Σ PENDING; el grid lo resta solo en precio fijo (ver countLabel)
  price: number | null;
  refineLevel: number;
  cardSlots: number;
  item: Item;
  poster: Poster;
  options: ListingOption[];
};

type MarketView = "grid" | "list";
const VIEW_STORAGE_KEY = "marketView";

// Aplica los patches del store (mutaciones hechas en el detalle) sobre las cards:
// actualiza vendido/reservado, y si el listing dejó de estar ACTIVE lo quita.
function applyPatches(
  listings: Listing[],
  patches: ReadonlyMap<string, ListingCardPatch>,
): Listing[] {
  if (patches.size === 0) return listings;
  const out: Listing[] = [];
  for (const l of listings) {
    const p = patches.get(l.id);
    if (!p) {
      out.push(l);
    } else if (p.status === "ACTIVE") {
      out.push({ ...l, sold: p.sold, reserved: p.reserved });
    }
    // status !== ACTIVE => se omite (comprado/vendido del todo o cancelado).
  }
  return out;
}

// Una card de listing. `variant` decide la forma: "row" = fila horizontal
// (icono | contenido | precio), para la vista lista en desktop; "tile" =
// apilada y compacta, para la vista cuadrícula y para la lista en móvil.
function ListingCard({
  listing,
  href,
  showBadge,
  currentUserId,
  dmAvailable,
  variant,
  className,
}: {
  listing: Listing;
  href: string;
  showBadge: boolean;
  currentUserId: string;
  dmAvailable: boolean;
  variant: "row" | "tile";
  className?: string;
}) {
  const t = useTranslations("market");

  const badge = showBadge ? (
    <span
      className={`self-start rounded border px-1.5 py-0.5 text-xs font-normal ${LISTING_TYPE_BADGE_CLASS[listing.type]}`}
    >
      {listingTypeLabel(t, listing.type)}
    </span>
  ) : null;

  // Disponible = cantidad − vendido − reservado, salvo en competitivo ("sin
  // precio", SALE/BUY con price null) y TRADE, donde lo pendiente no retiene
  // stock (misma regla que el detalle, ver deals.ts).
  const isCompetitive =
    (listing.type === "SALE" || listing.type === "BUY") && listing.price === null;
  const holdsReserved =
    (listing.type === "SALE" || listing.type === "BUY" || listing.type === "GIFT") &&
    !isCompetitive;
  const available =
    listing.quantity === null
      ? null
      : Math.max(0, listing.quantity - listing.sold - (holdsReserved ? listing.reserved : 0));
  const countLabel =
    available === null
      ? t("results.availableUnlimited")
      : listing.type === "BUY"
        ? t("results.wanted", { count: available })
        : t("results.available", { count: available });
  const roleLabel =
    listing.type === "BUY"
      ? t("results.wantedBy")
      : listing.type === "TRADE"
        ? t("results.tradedBy")
        : listing.type === "GIFT"
          ? t("results.giftedBy")
          : t("results.soldBy");
  const posterLine = (
    <p className="text-sm text-ro-text-muted">
      {/* La cantidad se muestra en todos los tipos, incluidas las compras
          (unidades que aún se buscan) — mismo formato que las ventas. */}
      {`${countLabel} · `}
      {roleLabel}{" "}
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
  // TRADE y GIFT no llevan precio en la card. En SALE/BUY, precio null = "sin
  // precio" (competitivo) => "Hacer oferta"; si no, el importe (sin el "hasta"
  // en compras: el precio de compra ya no es un máximo).
  const priceLine =
    listing.type === "TRADE" || listing.type === "GIFT" ? null : listing.price === null ? (
      <p className="font-bold text-ro-text-muted">
        {listing.type === "BUY" ? t("field.bestPrice") : t("field.bestOffer")}
      </p>
    ) : (
      <p className={`font-bold ${priceColorClass(listing.price)}`}>{formatPrice(listing.price)}</p>
    );

  const name = formatItemDisplayName(listing.item.name, listing.refineLevel, listing.cardSlots);

  if (variant === "row") {
    return (
      <Link
        href={href}
        scroll={false}
        className={`items-center gap-4 rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 text-ro-text transition-colors hover:border-ro-accent ${className ?? ""}`}
      >
        <Image src={listing.item.iconUrl} alt={listing.item.name} width={40} height={40} />
        <div className="flex-1">
          <p className="flex items-center gap-2 font-semibold">
            {name}
            {badge}
          </p>
          {posterLine}
          {listing.options.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-1">
              {listing.options.map((o) => (
                <span
                  key={o.slotIndex}
                  className="rounded border border-ro-panel-border bg-ro-panel-alt px-1.5 py-0.5 text-xs text-ro-text-muted"
                >
                  {o.def.label} {formatOptionAmount(o.value, listing.type === "BUY")}
                </span>
              ))}
            </p>
          )}
        </div>
        {priceLine}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      scroll={false}
      className={`flex h-full flex-col gap-2 rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 text-ro-text transition-colors hover:border-ro-accent ${className ?? ""}`}
    >
      {badge}
      <div className="flex items-center gap-3">
        <Image src={listing.item.iconUrl} alt={listing.item.name} width={40} height={40} />
        <p className="flex-1 font-semibold">{name}</p>
      </div>
      {posterLine}
      {listing.options.length > 0 && (
        <div className="flex flex-col gap-1">
          {listing.options.map((o) => (
            <div
              key={o.slotIndex}
              className="rounded border border-ro-panel-border bg-ro-panel-alt px-2 py-1.5 text-sm text-ro-text-muted"
            >
              {o.def.label} {formatOptionAmount(o.value, listing.type === "BUY")}
            </div>
          ))}
        </div>
      )}
      {priceLine}
    </Link>
  );
}

function ViewToggle({ view, onChange }: { view: MarketView; onChange: (v: MarketView) => void }) {
  const t = useTranslations("market");
  const options: { value: MarketView; Icon: typeof LayoutGrid; label: string }[] = [
    { value: "grid", Icon: LayoutGrid, label: t("view.grid") },
    { value: "list", Icon: ListIcon, label: t("view.list") },
  ];
  return (
    <div
      role="group"
      aria-label={t("view.label")}
      className="inline-flex overflow-hidden rounded-md border border-ro-panel-border"
    >
      {options.map((o) => {
        const active = view === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            title={o.label}
            onClick={() => onChange(o.value)}
            className={`grid h-8 w-8 place-items-center transition-colors ${
              active ? "bg-ro-type-all text-ro-on-type" : "text-ro-text-muted hover:bg-ro-text/5"
            }`}
          >
            <o.Icon size={16} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

export function MarketResults({
  initialListings,
  initialCursor,
  total,
  filters,
  currentUserId,
  dmAvailable = false,
}: {
  initialListings: Listing[];
  initialCursor: string | null;
  total: number;
  filters: Omit<MarketFilters, "cursor">;
  currentUserId: string;
  dmAvailable?: boolean;
}) {
  const [listings, setListings] = useState(initialListings);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Cuadrícula por defecto; la preferencia se recuerda en localStorage. Se
  // inicia igual en servidor y cliente (evita desajuste de hidratación) y se
  // ajusta tras montar si hay algo guardado.
  const [view, setView] = useState<MarketView>("grid");
  useEffect(() => {
    // Sincronización con localStorage al montar: no puede leerse en render (SSR
    // no tiene localStorage; leerlo ahí desajustaría la hidratación), y es
    // puramente de cliente (usar ?view= forzaría un refetch del servidor). Es un
    // setState-en-efecto legítimo.
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "grid" || stored === "list") setView(stored);
  }, []);
  function changeView(next: MarketView) {
    setView(next);
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  }

  const t = useTranslations("market");
  const tCommon = useTranslations("common");
  // Patches de mutaciones hechas en el detalle (ver listingStore.ts): se fusionan
  // sobre las cards para reflejar la compra/venta sin recargar, en cualquier
  // página cargada. Al montar el grid (nueva vista del servidor) se limpian.
  const patches = useListingPatches();
  const displayed = useMemo(() => applyPatches(listings, patches), [listings, patches]);
  useEffect(() => {
    clearListingPatches();
  }, []);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Abre el detalle como panel superpuesto (?listing=<id>) en vez de navegar a
  // /market/[id] — así el mercado se queda montado detrás. La página
  // /market/[id] se conserva aparte para enlaces directos/compartidos.
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

  const showBadge = !filters.type;

  return (
    <div>
      {/* Cabecera de resultados: contador "X de Y" + orden + vista grid/lista. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ro-text-muted">
          {t("results.count", { shown: displayed.length, total })}
        </p>
        <div className="flex items-center gap-3">
          <SortSelect />
          <ViewToggle view={view} onChange={changeView} />
        </div>
      </div>

      {displayed.length === 0 ? (
        <p className="text-ro-text-light/70">{t("results.empty")}</p>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((listing) => (
            <li key={listing.id}>
              <ListingCard
                listing={listing}
                href={listingHref(listing.id)}
                showBadge={showBadge}
                currentUserId={currentUserId}
                dmAvailable={dmAvailable}
                variant="tile"
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {displayed.map((listing) => (
            <li key={listing.id}>
              {/* Fila horizontal en desktop; apilada (tile) en móvil. */}
              <ListingCard
                listing={listing}
                href={listingHref(listing.id)}
                showBadge={showBadge}
                currentUserId={currentUserId}
                dmAvailable={dmAvailable}
                variant="row"
                className="hidden sm:flex"
              />
              <ListingCard
                listing={listing}
                href={listingHref(listing.id)}
                showBadge={showBadge}
                currentUserId={currentUserId}
                dmAvailable={dmAvailable}
                variant="tile"
                className="sm:hidden"
              />
            </li>
          ))}
        </ul>
      )}

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
