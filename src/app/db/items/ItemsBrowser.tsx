"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ItemCategory } from "@prisma/client";
import { X } from "lucide-react";
import { categoryLabel } from "@/lib/market-labels";
import { inputClass, selectClass } from "@/lib/ui";
import { fetchDbItemDetail } from "./actions";
import { ItemTooltip } from "./ItemTooltip";
import type { DbItemCard, DbItemDetail } from "@/lib/db-items";

const CATEGORIES = Object.values(ItemCategory);

export function ItemsBrowser({
  items,
  total,
  page,
  pages,
  query,
  category,
}: {
  items: DbItemCard[];
  total: number;
  page: number;
  pages: number;
  query: string;
  category: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tMarket = useTranslations("market");
  const t = useTranslations("db.items");
  const [q, setQ] = useState(query);
  const [selected, setSelected] = useState<DbItemDetail | null>(null);
  const [isLoadingDetail, startDetail] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Si la URL cambia por fuera (atrás/adelante), re-sincroniza el input. Ajuste
  // de estado EN RENDER (patrón recomendado por React) en vez de un effect.
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (query !== syncedQuery) {
    setSyncedQuery(query);
    setQ(query);
  }

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  function pushParams(next: { q?: string; category?: string; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.q !== undefined) next.q ? params.set("q", next.q) : params.delete("q");
    if (next.category !== undefined)
      next.category ? params.set("category", next.category) : params.delete("category");
    // Cambiar búsqueda o filtro vuelve a la página 1 (se borra el param); solo
    // la paginación fija una página explícita.
    if (next.page !== undefined) params.set("page", String(next.page));
    else params.delete("page");
    router.push(`/db/items?${params.toString()}`);
  }

  function handleSearch(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushParams({ q: value }), 300);
  }

  function openDetail(id: string) {
    startDetail(async () => {
      const detail = await fetchDbItemDetail(id);
      if (detail) setSelected(detail);
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className={`${inputClass} h-10 min-w-[12rem] flex-1`}
        />
        <select
          value={category}
          onChange={(e) => pushParams({ category: e.target.value })}
          className={`${selectClass} h-10`}
        >
          <option value="">{t("allCategories")}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(tMarket, c)}
            </option>
          ))}
        </select>
      </div>

      <p className="mb-3 text-xs text-ro-text-muted">{t("count", { total })}</p>

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-ro-text-muted">{t("empty")}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openDetail(item.id)}
                className="flex h-full w-full flex-col items-center gap-1.5 rounded-lg border-2 border-ro-panel-border bg-ro-panel p-3 text-center transition-colors hover:border-ro-accent"
              >
                <Image src={item.iconUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0" />
                <span className="line-clamp-2 text-xs text-ro-text">
                  {item.slotCount > 0 ? `${item.name} [${item.slotCount}]` : item.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => pushParams({ page: page - 1 })}
            className="rounded-md border-2 border-ro-panel-border px-3 py-1.5 hover:enabled:border-ro-accent disabled:opacity-40"
          >
            {t("prev")}
          </button>
          <span className="tabular-nums text-ro-text-muted">{t("pageOf", { page, pages })}</span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => pushParams({ page: page + 1 })}
            className="rounded-md border-2 border-ro-panel-border px-3 py-1.5 hover:enabled:border-ro-accent disabled:opacity-40"
          >
            {t("next")}
          </button>
        </div>
      )}

      {isLoadingDetail && (
        <p className="mt-3 text-center text-xs text-ro-text-muted">{t("loadingDetail")}</p>
      )}

      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} label={t("close")} />}
    </div>
  );
}

// Modal del tooltip. Cierra con la X, click en el fondo o Escape.
function DetailModal({
  item,
  onClose,
  label,
}: {
  item: DbItemDetail;
  onClose: () => void;
  label: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={label}
          className="absolute right-3 top-3 text-ro-text-muted hover:text-ro-text"
        >
          <X size={18} />
        </button>
        <ItemTooltip item={item} />
      </div>
    </div>
  );
}
