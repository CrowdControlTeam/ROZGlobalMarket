"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ItemIcon } from "@/components/ItemIcon";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutGrid, Search, Eye, Share2, Pencil, MessageSquare, SlidersHorizontal, X } from "lucide-react";
import { loadMoreListings } from "@/lib/market-actions";
import type { MarketFilters } from "@/lib/market";
import { buttonClass } from "@/lib/ui";
import { formatPrice, priceColorClass } from "@/lib/price";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { listingTypeLabel, LISTING_TYPE_BADGE_CLASS, formatOptionAmount } from "@/lib/market-labels";
import { getErrorMessage } from "@/lib/errors";
import { UserMention, ContactModal } from "@/components/UserMention";
import { KebabMenu, type KebabItem } from "@/components/KebabMenu";
import { NoteIndicator } from "@/components/NoteIndicator";
import { ExpiryIndicator } from "@/components/ExpiryIndicator";
import { Toast } from "@/components/Toast";
import { SortSelect } from "./SortSelect";
import { useMarketSearch } from "./marketSearchStore";
import { useListingPatches, clearListingPatches } from "./listingStore";
import type { ListingCardPatch } from "@/lib/listing-card";

type Item = { id: string; name: string; iconUrl: string; slotCount: number };
type Poster = { id: string; username: string };
type ListingOption = { slotIndex: number; value: number; def: { label: string } };
type ListingCardChip = { slotIndex: number; card: { id: string; name: string; iconUrl: string } };
type Listing = {
  id: string;
  type: "SALE" | "TRADE" | "BUY" | "GIFT";
  quantity: number | null; // null = ilimitado ("los que tengas")
  sold: number;
  reserved: number; // Σ PENDING; se resta solo en precio fijo (ver countLabel)
  hasLiveDeals: boolean; // algún Deal PENDING/ACCEPTED (mode-independiente): gate de editar
  price: number | null;
  refineLevel: number;
  notes: string | null;
  expiresAt: Date | string | null; // caducidad (indicador de reloj); null = no caduca
  item: Item;
  poster: Poster;
  options: ListingOption[];
  cards: ListingCardChip[];
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
  editHref,
  // replace = ya hay un detalle abierto (?listing en la URL): al abrir otro
  // listing se REEMPLAZA en el historial en vez de apilar, para que la ✕
  // (router.back) cierre al mercado y no al detalle anterior.
  replace,
  showBadge,
  currentUserId,
  dmAvailable,
  variant,
  className,
}: {
  listing: Listing;
  href: string;
  editHref: string;
  replace: boolean;
  showBadge: boolean;
  currentUserId: string;
  dmAvailable: boolean;
  variant: "row" | "tile";
  className?: string;
}) {
  const t = useTranslations("market");
  const router = useRouter();
  const [contactOpen, setContactOpen] = useState(false);
  const [editWarning, setEditWarning] = useState<string | null>(null);
  // "Editar" se OFRECE a cualquier dueño (isOwner), pero solo NAVEGA si es
  // editable: sin NINGÚN deal vivo (PENDING o ACCEPTED). Se usa hasLiveDeals
  // (mode-independiente), no `reserved` (que es 0 en competitivo/trade aunque
  // haya ofertas). CANCELLED/REJECTED no cuentan → al cancelarse, vuelve a ser
  // editable. Si no lo es, en vez de ocultar el botón se avisa al pulsar.
  const isOwner = listing.poster.id === currentUserId;
  const canEdit = isOwner && !listing.hasLiveDeals;
  // Contactar: al vendedor (no a uno mismo) y con el bot de DMs disponible.
  const canContact = dmAvailable && listing.poster.id !== currentUserId && !!listing.item;

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

  const name = formatItemDisplayName(listing.item.name, listing.refineLevel, listing.item.slotCount);
  const iconBox = (
    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-ro-panel-border bg-ro-panel-alt">
      <ItemIcon
        item={listing.item}
        width={32}
        height={32}
        refine={listing.refineLevel}
        options={listing.options.map(
          (o) => `${o.def.label} ${formatOptionAmount(o.value, listing.type === "BUY")}`,
        )}
      />
    </div>
  );
  const meta = (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ro-text-muted">
      {badge}
      <span>
        · <UserMention userId={listing.poster.id} username={listing.poster.username} viewerId={currentUserId} capitalize item={listing.item} listingId={listing.id} dmAvailable={dmAvailable} onContactClick={canContact ? () => setContactOpen(true) : undefined} />
      </span>
    </p>
  );
  const expiryLine = listing.expiresAt ? (
    <ExpiryIndicator expiresAt={listing.expiresAt} className="text-[0.65rem] text-ro-text-muted" />
  ) : null;
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
  const cardChips =
    listing.cards.length > 0 ? (
      <div className="mt-1 flex flex-wrap gap-1">
        {listing.cards.map((c) => (
          <span
            key={c.slotIndex}
            className="inline-flex items-center gap-0.5 rounded border border-ro-panel-border bg-ro-panel px-1 py-0.5 text-[0.65rem] text-ro-text-muted"
          >
            <ItemIcon item={c.card} width={14} height={14} alt="" />
            {c.card.name}
          </span>
        ))}
      </div>
    ) : null;

  const kebabItems: KebabItem[] = [
    ...(isOwner
      ? [
          {
            label: t("card.edit"),
            icon: <Pencil size={14} aria-hidden />,
            onSelect: () => (canEdit ? router.push(editHref) : setEditWarning(t("card.editBlocked"))),
          },
        ]
      : []),
    { label: t("card.viewDetail"), icon: <Eye size={14} aria-hidden />, onSelect: () => (replace ? router.replace(href) : router.push(href)) },
    {
      label: t("card.share"),
      icon: <Share2 size={14} aria-hidden />,
      onSelect: () => {
        const url = `${window.location.origin}/market/${listing.id}`;
        if (typeof navigator !== "undefined" && navigator.share) {
          navigator.share({ url }).catch(() => {});
        } else {
          navigator.clipboard?.writeText(url);
        }
      },
    },
    ...(canContact
      ? [
          {
            label: t("card.contact"),
            icon: <MessageSquare size={14} aria-hidden />,
            onSelect: () => setContactOpen(true),
          },
        ]
      : []),
  ];

  // Columna de acciones en la esquina superior derecha: kebab arriba y, debajo,
  // el indicador de notas (bocadillo, solo si hay). Aquí irá también el botón de
  // favorito más adelante. Va sobre la tarjeta (fuera del <Link>) para no anidar
  // controles dentro del <a>. Es de un icono de ancho (igual que el kebab), así
  // que no interfiere con el nombre por muy largo que sea.
  const cornerActions = (
    <div className="absolute right-1.5 top-1.5 flex flex-col items-center gap-1">
      <KebabMenu label={t("card.menu")} items={kebabItems} />
      {listing.notes && (
        <NoteIndicator label={listing.notes} className="grid h-6 w-6 place-items-center" />
      )}
    </div>
  );

  // Panel de contacto compartido por el kebab ("Contactar") y el click en el
  // nombre del vendedor. Portalea a document.body, así que da igual desde qué
  // rama se renderice.
  const contactModal = canContact ? (
    <ContactModal
      open={contactOpen}
      onClose={() => setContactOpen(false)}
      recipientId={listing.poster.id}
      recipientUsername={listing.poster.username}
      item={listing.item}
      listingId={listing.id}
    />
  ) : null;

  // Aviso al intentar editar una publicación no editable (con ofertas/ventas).
  const warningToast = editWarning ? (
    <Toast message={editWarning} onDismiss={() => setEditWarning(null)} />
  ) : null;

  if (variant === "row") {
    return (
      <div className={`relative h-full ${className ?? ""}`}>
        <Link
          href={href}
          replace={replace}
          scroll={false}
          className="flex h-full items-center gap-3 rounded-xl border border-ro-panel-border bg-ro-panel p-3 pr-10 transition-colors hover:border-ro-accent"
        >
          {iconBox}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ro-text">{name}</p>
            {meta}
            {optionChips}
            {cardChips}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm">{priceLine}</div>
            <div className="mt-0.5 text-xs text-ro-text-muted">{countLabel}</div>
            {expiryLine && <div className="mt-0.5 flex justify-end">{expiryLine}</div>}
          </div>
        </Link>
        {cornerActions}
        {contactModal}
        {warningToast}
      </div>
    );
  }

  return (
    <div className={`relative h-full ${className ?? ""}`}>
      <Link
        href={href}
        replace={replace}
        scroll={false}
        className="flex h-full flex-col rounded-xl border border-ro-panel-border bg-ro-panel p-3 transition-colors hover:border-ro-accent"
      >
        <div className="flex gap-2.5">
          {iconBox}
          {/* pr-5 en el contenedor (no solo en el nombre) para que también el
              meta libre la columna de acciones de la esquina. */}
          <div className="min-w-0 flex-1 pr-5">
            <p className="truncate text-sm font-bold text-ro-text">{name}</p>
            {meta}
          </div>
        </div>
        {optionChips}
        {cardChips}
        {/* mt-auto ancla el precio abajo: con auto-rows-fr todas las tarjetas
            de la fila igualan altura y el precio queda alineado. */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-ro-text-muted">{countLabel}</span>
            {expiryLine}
          </div>
          <span className="text-sm">{priceLine}</span>
        </div>
      </Link>
      {cornerActions}
      {contactModal}
      {warningToast}
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

  // El grid mantiene los listings en estado de cliente (para "Cargar más").
  // Cuando el servidor entrega una nueva página inicial —al cambiar filtros,
  // orden o la búsqueda `q`— reseteamos ese estado en el propio render (patrón
  // sancionado de React: ajustar estado durante el render al cambiar una prop,
  // rastreando el valor previo con estado). Así la lista se refresca SIN
  // remontar la sección, lo que permite dejar `q` fuera de la key del Suspense
  // y conservar el foco del buscador al teclear.
  const [prevInitial, setPrevInitial] = useState(initialListings);
  if (prevInitial !== initialListings) {
    setPrevInitial(initialListings);
    setListings(initialListings);
    setCursor(initialCursor);
  }

  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("market");
  const tCommon = useTranslations("common");
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

  // Buscador por nombre (cabecera de resultados): controlado por el store, que
  // aplica al vuelo (serializa `q` a la URL con debounce). Al estar controlado
  // por el store —estable, no se remonta al teclear— conserva el foco. Enter no
  // hace nada especial (ya aplica al escribir); se evita el submit por defecto
  // para no recargar la página.
  const { filters: searchFilters, setFilter: setSearchFilter, setMobileFiltersOpen } = useMarketSearch();
  const q = searchFilters.q ?? "";
  // Hay filtros de PANEL activos (excluye tipo/orden/búsqueda por nombre): pinta
  // un punto en el icono de Filtros de la cabecera.
  const hasPanelFilters = Object.entries(searchFilters).some(
    ([k, v]) => v && k !== "q" && k !== "sort" && k !== "type",
  );
  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
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

  // Href del modal de editar (?edit=). Quita `listing` para no apilar el modal
  // sobre un detalle abierto.
  function editHref(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("listing");
    params.set("edit", id);
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
  // Si ya hay un detalle abierto (?listing en la URL), abrir otro listing debe
  // REEMPLAZAR esa entrada del historial, no apilar otra — así la ✕ cierra al
  // mercado y no va saltando por los detalles vistos.
  const detailOpen = !!searchParams.get("listing");
  const cardProps = (listing: Listing) => ({
    listing,
    href: listingHref(listing.id),
    editHref: editHref(listing.id),
    replace: detailOpen,
    showBadge,
    currentUserId,
    dmAvailable,
  });

  return (
    <div>
      {/* Cabecera de resultados. Móvil: 2 filas — (Filtros icono + buscador) y
          (resultados + orden). Desktop: 1 fila con el buscador a la izquierda y
          resultados/orden/vista a la derecha. El toggle grid/lista es solo
          desktop (en móvil siempre una columna). */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Fila A: Filtros (solo icono, < 1100px) + buscador por nombre. */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            aria-label={t("filters.toggle")}
            title={t("filters.toggle")}
            className="relative grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg border border-ro-panel-border bg-ro-panel-alt text-ro-accent min-[1100px]:hidden"
          >
            <SlidersHorizontal size={16} aria-hidden />
            {hasPanelFilters && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-ro-accent" />}
          </button>
          <form
            onSubmit={submitSearch}
            // Móvil: a todo el ancho de su fila (flex-1). Desktop: ancho fijo de
            // 300px (con flex-1 solo se ajustaba al contenido, ~212px).
            className="flex flex-1 items-center gap-2 rounded-lg border border-ro-panel-border bg-ro-panel-alt px-3 py-1.5 sm:w-[300px] sm:flex-none"
          >
            <Search size={14} className="shrink-0 text-ro-text-muted" aria-hidden />
            <input
              type="text"
              value={q}
              onChange={(e) => setSearchFilter("q", e.target.value)}
              placeholder={t("filters.namePlaceholder")}
              aria-label={t("filters.name")}
              className="min-w-0 flex-1 bg-transparent text-xs text-ro-text placeholder:text-ro-text-muted focus:outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => setSearchFilter("q", "")}
                aria-label={t("filters.clearName")}
                title={t("filters.clearName")}
                className="grid h-5 w-5 shrink-0 place-items-center rounded text-ro-text-muted transition-colors hover:bg-ro-panel-border/60 hover:text-ro-text"
              >
                <X size={14} aria-hidden />
              </button>
            )}
          </form>
        </div>
        {/* Fila B: resultados + orden (+ vista solo en desktop). */}
        <div className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-normal">
          <span className="shrink-0 text-xs text-ro-text-muted">
            {t.rich("results.count", {
              shown: displayed.length,
              total,
              b: (chunks) => <b className="font-bold text-ro-text">{chunks}</b>,
            })}
          </span>
          <SortSelect />
          <div className="hidden sm:block">
            <ViewToggle view={view} onChange={changeView} />
          </div>
        </div>
      </div>

      {displayed.length === 0 ? (
        <p className="text-ro-text-light/70">{t("results.empty")}</p>
      ) : view === "grid" ? (
        <ul className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((listing) => (
            <li key={listing.id}>
              <ListingCard {...cardProps(listing)} variant="tile" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid auto-rows-fr grid-cols-1 gap-3">
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
