"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutGrid, Search, Eye, Copy } from "lucide-react";
import { loadMoreListings } from "@/lib/market-actions";
import type { MarketFilters } from "@/lib/market";
import { buttonClass } from "@/lib/ui";
import { formatPrice, priceColorClass } from "@/lib/price";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { listingTypeLabel, LISTING_TYPE_BADGE_CLASS, formatOptionAmount } from "@/lib/market-labels";
import { getErrorMessage } from "@/lib/errors";
import { UserMention } from "@/components/UserMention";
import { KebabMenu } from "@/components/KebabMenu";
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
  reserved: number; // Σ PENDING; se resta solo en precio fijo (ver countLabel)
  price: number | null;
  refineLevel: number;
  cardSlots: number;
  item: Item;
  poster: Poster;
  options: ListingOption[];
};

type MarketView = "grid" | "list";
const VIEW_STORAGE_KEY = "marketView";

// Icono de lista = 3 rayas (el de rejilla es LayoutGrid = 4 celdas).
function ListLinesIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

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

// Una card de listing estilo diseño (gcard). `variant` decide la forma: "tile"
// = apilada compacta (rejilla y móvil); "row" = fila horizontal (lista en
// desktop). La tarjeta es un <Link>; el kebab va como hermano posicionado
// encima para no anidar un botón dentro del <a>.
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
  const router = useRouter();

  const badge = showBadge ? (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide ${LISTING_TYPE_BADGE_CLASS[listing.type]}`}
    >
      {listingTypeLabel(t, listing.type)}
    </span>
  ) : null;

  const isCompetitive =
    (listing.type === "SALE" || listing.type === "BUY") && listing.price === null;
  const holdsReserved =
    (listing.type === "SALE" || listing.type === "BUY" || listing.type === "GIFT") && !isCompetitive;
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

  // Precio/valor por tipo: SALE/BUY = importe (color por tramo) o "Hacer
  // oferta" si es competitivo; TRADE = "Intercambio" (azul); GIFT = "Gratis"
  // (verde).
  const priceLine =
    listing.type === "TRADE" ? (
      <span className="font-extrabold text-ro-type-trade">{listingTypeLabel(t, "TRADE")}</span>
    ) : listing.type === "GIFT" ? (
      <span className="font-extrabold text-ro-type-buy">{t("results.free")}</span>
    ) : listing.price === null ? (
      <span className="font-bold text-ro-text-muted">
        {listing.type === "BUY" ? t("field.bestPrice") : t("field.bestOffer")}
      </span>
    ) : (
      <span className={`font-extrabold ${priceColorClass(listing.price)}`}>
        {formatPrice(listing.price)}
      </span>
    );

  const name = formatItemDisplayName(listing.item.name, listing.refineLevel, listing.cardSlots);
  const iconBox = (
    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-ro-panel-border bg-ro-panel-alt">
      <Image src={listing.item.iconUrl} alt={listing.item.name} width={32} height={32} />
    </div>
  );
  const meta = (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ro-text-muted">
      {badge}
      <span>
        · <UserMention userId={listing.poster.id} username={listing.poster.username} viewerId={currentUserId} capitalize item={listing.item} listingId={listing.id} dmAvailable={dmAvailable} />
      </span>
    </p>
  );
  const optionChips =
    listing.options.length > 0 ? (
      <div className="mt-2 flex flex-wrap gap-1">
        {listing.options.map((o) => (
          <span
            key={o.slotIndex}
            className="rounded border border-ro-accent/30 bg-ro-accent/10 px-1.5 py-0.5 text-[0.65rem] text-ro-accent"
          >
            {o.def.label} {formatOptionAmount(o.value, listing.type === "BUY")}
          </span>
        ))}
      </div>
    ) : null;

  const kebab = (
    <div className="absolute right-1.5 top-1.5">
      <KebabMenu
        label={t("card.menu")}
        items={[
          { label: t("card.viewDetail"), icon: <Eye size={14} aria-hidden />, onSelect: () => router.push(href) },
          {
            label: t("card.copyLink"),
            icon: <Copy size={14} aria-hidden />,
            onSelect: () => navigator.clipboard?.writeText(`${window.location.origin}/market/${listing.id}`),
          },
        ]}
      />
    </div>
  );

  if (variant === "row") {
    return (
      <div className={`relative ${className ?? ""}`}>
        <Link
          href={href}
          scroll={false}
          className="flex items-center gap-3 rounded-xl border border-ro-panel-border bg-ro-panel p-3 pr-10 transition-colors hover:border-ro-accent"
        >
          {iconBox}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ro-text">{name}</p>
            {meta}
            {optionChips}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm">{priceLine}</div>
            <div className="mt-0.5 text-xs text-ro-text-muted">{countLabel}</div>
          </div>
        </Link>
        {kebab}
      </div>
    );
  }

  return (
    <div className={`relative h-full ${className ?? ""}`}>
      <Link
        href={href}
        scroll={false}
        className="flex h-full flex-col rounded-xl border border-ro-panel-border bg-ro-panel p-3 transition-colors hover:border-ro-accent"
      >
        <div className="flex gap-2.5">
          {iconBox}
          <div className="min-w-0 flex-1">
            <p className="truncate pr-5 text-sm font-bold text-ro-text">{name}</p>
            {meta}
          </div>
        </div>
        {optionChips}
        {/* mt-auto ancla el precio abajo: con auto-rows-fr todas las tarjetas
            de la fila igualan altura y el precio queda alineado. */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="text-xs text-ro-text-muted">{countLabel}</span>
          <span className="text-sm">{priceLine}</span>
        </div>
      </Link>
      {kebab}
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: MarketView; onChange: (v: MarketView) => void }) {
  const t = useTranslations("market");
  return (
    <div
      role="group"
      aria-label={t("view.label")}
      className="inline-flex overflow-hidden rounded-lg border border-ro-panel-border"
    >
      <button
        type="button"
        aria-pressed={view === "grid"}
        title={t("view.grid")}
        onClick={() => onChange("grid")}
        className={`grid h-8 w-9 place-items-center transition-colors ${
          view === "grid" ? "bg-ro-type-all text-ro-on-type" : "text-ro-text-muted hover:bg-ro-text/5"
        }`}
      >
        <LayoutGrid size={15} aria-hidden />
      </button>
      <button
        type="button"
        aria-pressed={view === "list"}
        title={t("view.list")}
        onClick={() => onChange("list")}
        className={`grid h-8 w-9 place-items-center transition-colors ${
          view === "list" ? "bg-ro-type-all text-ro-on-type" : "text-ro-text-muted hover:bg-ro-text/5"
        }`}
      >
        <ListLinesIcon />
      </button>
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
  const t = useTranslations("market");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Vista rejilla por defecto; la preferencia se recuerda en localStorage. Se
  // inicia igual en servidor y cliente (evita desajuste de hidratación) y se
  // ajusta tras montar si hay algo guardado.
  const [view, setView] = useState<MarketView>("grid");
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "grid" || stored === "list") setView(stored);
  }, []);
  function changeView(next: MarketView) {
    setView(next);
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  }

  // Buscador por nombre (cabecera de resultados): aplica al enviar (Enter).
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = q.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    params.delete("listing");
    router.push(`${pathname}?${params.toString()}`);
  }

  // Patches de mutaciones hechas en el detalle (ver listingStore.ts): se fusionan
  // sobre las cards para reflejar la compra/venta sin recargar. Al montar el
  // grid (nueva vista del servidor) se limpian.
  const patches = useListingPatches();
  const displayed = useMemo(() => applyPatches(listings, patches), [listings, patches]);
  useEffect(() => {
    clearListingPatches();
  }, []);

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

  // El badge de tipo se muestra siempre (también con un tipo filtrado), como
  // referencia visual constante.
  const showBadge = true;
  const cardProps = (listing: Listing) => ({
    listing,
    href: listingHref(listing.id),
    showBadge,
    currentUserId,
    dmAvailable,
  });

  return (
    <div>
      {/* Cabecera de resultados: buscador + contador "X de Y" + orden + vista. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form
          onSubmit={submitSearch}
          className="flex flex-1 items-center gap-2 rounded-lg border border-ro-panel-border bg-ro-panel-alt px-3 py-1.5 sm:max-w-[240px]"
        >
          <Search size={14} className="shrink-0 text-ro-text-muted" aria-hidden />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("filters.namePlaceholder")}
            aria-label={t("filters.name")}
            className="min-w-0 flex-1 bg-transparent text-xs text-ro-text placeholder:text-ro-text-muted focus:outline-none"
          />
        </form>
        <span className="ml-auto shrink-0 text-xs text-ro-text-muted">
          {t.rich("results.count", {
            shown: displayed.length,
            total,
            b: (chunks) => <b className="font-bold text-ro-text">{chunks}</b>,
          })}
        </span>
        <SortSelect />
        <ViewToggle view={view} onChange={changeView} />
      </div>

      {displayed.length === 0 ? (
        <p className="text-ro-text-light/70">{t("results.empty")}</p>
      ) : view === "grid" ? (
        <ul className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2">
          {displayed.map((listing) => (
            <li key={listing.id}>
              <ListingCard {...cardProps(listing)} variant="tile" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {displayed.map((listing) => (
            <li key={listing.id}>
              {/* Fila en desktop; tile apilado en móvil. */}
              <ListingCard {...cardProps(listing)} variant="row" className="hidden sm:block" />
              <ListingCard {...cardProps(listing)} variant="tile" className="sm:hidden" />
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
