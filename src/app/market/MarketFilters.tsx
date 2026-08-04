"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  X,
  Coins,
  Boxes,
  Shield,
  Sword,
  Sparkles,
  SquareStack,
  SlidersHorizontal,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ItemCategory, EquipSlot, WeaponType, type ItemOptionDef } from "@prisma/client";
import { categoryLabel, slotLabel, weaponTypeLabel } from "@/lib/market-labels";
import { MAX_OPTION_SLOTS } from "@/lib/item-options-constants";
import { isRefineEligible, DEFAULT_MAX_REFINE_LEVEL } from "@/lib/refine-constants";
import { getMaxCardSlots, MAX_WEAPON_CARD_SLOTS } from "@/lib/card-slots-constants";
import {
  getAllOptionChoices,
  getMaxRefineLevel,
  getOptionsFeatureAvailable,
} from "@/lib/listings";
import { inputBaseClass, selectClass } from "@/lib/ui";
import { MaskedPriceInput } from "@/components/MaskedPriceInput";
import { UserPicker, type UserResult } from "@/components/UserPicker";
import { Drawer } from "@/components/Drawer";

type OptionFilterSelection = { statCode: string; min: number | ""; max: number | "" };

function emptyOptionFilterSelections(): OptionFilterSelection[] {
  return Array.from({ length: MAX_OPTION_SLOTS }, () => ({ statCode: "", min: "", max: "" }));
}

type StatOption = { statCode: string; label: string; minValue: number; maxValue: number };

// Un mismo stat existe como filas de ItemOptionDef distintas en cada grupo; el
// filtro busca por posición sin importar el grupo, así que se dedupea por
// statCode fusionando el rango [min,max] (solo afecta al placeholder).
function dedupeByStat(defs: ItemOptionDef[]): StatOption[] {
  const byCode = new Map<string, StatOption>();
  for (const d of defs) {
    const existing = byCode.get(d.statCode);
    if (existing) {
      existing.minValue = Math.min(existing.minValue, d.minValue);
      existing.maxValue = Math.max(existing.maxValue, d.maxValue);
    } else {
      byCode.set(d.statCode, { statCode: d.statCode, label: d.label, minValue: d.minValue, maxValue: d.maxValue });
    }
  }
  return Array.from(byCode.values()).sort((a, b) => a.label.localeCompare(b.label));
}

type Section = { id: string; Icon: LucideIcon; label: string; count: number; clear: () => void; content: ReactNode };

export function MarketFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("market");

  // El tipo lo fija el SegmentedTypeSelector (query ?type=), no este panel —
  // aquí solo se lee para adaptar la semántica de las options en BUY.
  const type = searchParams.get("type") ?? "";

  const [poster, setPoster] = useState<UserResult | null>(() => {
    const posterId = searchParams.get("posterId");
    const posterName = searchParams.get("posterName");
    return posterId && posterName ? { id: posterId, username: posterName, avatarUrl: null } : null;
  });
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [slot, setSlot] = useState(searchParams.get("slot") ?? "");
  const [weaponType, setWeaponType] = useState(searchParams.get("weaponType") ?? "");
  const [minPrice, setMinPrice] = useState<number | "">(toNumberOrEmpty(searchParams.get("minPrice")));
  const [maxPrice, setMaxPrice] = useState<number | "">(toNumberOrEmpty(searchParams.get("maxPrice")));
  const [refineMin, setRefineMin] = useState<number | "">(toNumberOrEmpty(searchParams.get("refineMin")));
  const [refineMax, setRefineMax] = useState<number | "">(toNumberOrEmpty(searchParams.get("refineMax")));
  const [maxRefineLevel, setMaxRefineLevel] = useState(DEFAULT_MAX_REFINE_LEVEL);
  useEffect(() => {
    getMaxRefineLevel().then(setMaxRefineLevel);
  }, []);
  const [cardSlotsMin, setCardSlotsMin] = useState<number | "">(toNumberOrEmpty(searchParams.get("cardSlotsMin")));
  const [cardSlotsMax, setCardSlotsMax] = useState<number | "">(toNumberOrEmpty(searchParams.get("cardSlotsMax")));

  const [optionSelections, setOptionSelections] = useState<OptionFilterSelection[]>(() =>
    Array.from({ length: MAX_OPTION_SLOTS }, (_, i) => {
      const n = i + 1;
      return {
        statCode: searchParams.get(`option${n}Stat`) ?? "",
        min: toNumberOrEmpty(searchParams.get(`option${n}Min`)),
        max: toNumberOrEmpty(searchParams.get(`option${n}Max`)),
      };
    }),
  );

  const [allOptionDefs, setAllOptionDefs] = useState<ItemOptionDef[]>([]);
  const [optionsFeatureAvailable, setOptionsFeatureAvailable] = useState(true);
  useEffect(() => {
    getOptionsFeatureAvailable().then((available) => {
      setOptionsFeatureAvailable(available);
      if (available) getAllOptionChoices().then(setAllOptionDefs);
    });
  }, []);

  const statsBySlot = useMemo(() => {
    const bySlot: StatOption[][] = [];
    for (let slotIndex = 1; slotIndex <= MAX_OPTION_SLOTS; slotIndex++) {
      bySlot.push(dedupeByStat(allOptionDefs.filter((d) => d.slotIndex === slotIndex)));
    }
    return bySlot;
  }, [allOptionDefs]);

  const isBuyFilter = type === "BUY";
  const showSlot = category === ItemCategory.ARMOR || category === ItemCategory.CARD || category === "";
  const showWeaponType = category === ItemCategory.WEAPON || category === "";
  const refineFilterEnabled =
    category === "" ||
    category === ItemCategory.WEAPON ||
    (category === ItemCategory.ARMOR &&
      (slot === "" || isRefineEligible({ category: ItemCategory.ARMOR, slot: slot as EquipSlot })));
  const cardSlotsFilterEnabled =
    category === "" ||
    category === ItemCategory.WEAPON ||
    (category === ItemCategory.ARMOR &&
      (slot === "" || getMaxCardSlots({ category: ItemCategory.ARMOR, slot: slot as EquipSlot }) > 0));
  const cardSlotsFilterMax =
    category === ItemCategory.ARMOR && slot
      ? getMaxCardSlots({ category: ItemCategory.ARMOR, slot: slot as EquipSlot })
      : MAX_WEAPON_CARD_SLOTS;

  function handleOptionSelectChange(index: number, statCode: string) {
    setOptionSelections((prev) => {
      const next = [...prev];
      next[index] = { statCode, min: "", max: "" };
      return next;
    });
  }
  function handleOptionMinChange(index: number, value: number | "") {
    setOptionSelections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], min: value };
      return next;
    });
  }
  function handleOptionMaxChange(index: number, value: number | "") {
    setOptionSelections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], max: value };
      return next;
    });
  }

  // Aplicar AL VUELO: cada cambio de filtro empuja la URL con un debounce. El
  // orden (sort), la búsqueda por nombre (q) y el tipo viven fuera y se
  // conservan tal cual. En el montaje inicial el estado ya viene de la URL, así
  // que la comparación evita un push redundante.
  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      setOrDelete(params, "posterId", poster?.id ?? "");
      setOrDelete(params, "posterName", poster?.username ?? "");
      setOrDelete(params, "category", category);
      setOrDelete(params, "slot", slot);
      setOrDelete(params, "weaponType", weaponType);
      optionSelections.forEach((sel, i) => {
        const n = i + 1;
        setOrDelete(params, `option${n}Stat`, sel.statCode);
        setOrDelete(params, `option${n}Min`, !isBuyFilter && sel.statCode && sel.min !== "" ? String(sel.min) : "");
        setOrDelete(params, `option${n}Max`, sel.statCode && sel.max !== "" ? String(sel.max) : "");
      });
      setOrDelete(params, "refineMin", refineFilterEnabled && refineMin !== "" ? String(refineMin) : "");
      setOrDelete(params, "refineMax", refineFilterEnabled && refineMax !== "" ? String(refineMax) : "");
      setOrDelete(params, "cardSlotsMin", cardSlotsFilterEnabled && cardSlotsMin !== "" ? String(cardSlotsMin) : "");
      setOrDelete(params, "cardSlotsMax", cardSlotsFilterEnabled && cardSlotsMax !== "" ? String(cardSlotsMax) : "");
      setOrDelete(params, "minPrice", minPrice === "" ? "" : String(minPrice));
      setOrDelete(params, "maxPrice", maxPrice === "" ? "" : String(maxPrice));
      // Cerrar el detalle abierto al cambiar el filtro; reinicia paginación.
      params.delete("listing");
      const next = params.toString();
      const current = new URLSearchParams(searchParams.toString());
      current.delete("listing");
      if (next !== current.toString()) router.push(`${pathname}?${next}`);
    }, 400);
    return () => clearTimeout(handle);
  }, [
    poster, category, slot, weaponType, optionSelections, refineMin, refineMax, cardSlotsMin, cardSlotsMax,
    minPrice, maxPrice, isBuyFilter, refineFilterEnabled, cardSlotsFilterEnabled, searchParams, pathname, router,
  ]);

  function clearAll() {
    setPoster(null);
    setCategory("");
    setSlot("");
    setWeaponType("");
    setOptionSelections(emptyOptionFilterSelections());
    setRefineMin("");
    setRefineMax("");
    setCardSlotsMin("");
    setCardSlotsMax("");
    setMinPrice("");
    setMaxPrice("");
  }

  const optionsActive = optionSelections.filter((s) => s.statCode !== "").length;
  const sections: Section[] = [
    {
      id: "price",
      Icon: Coins,
      label: t("filters.priceSection"),
      count: (minPrice !== "" ? 1 : 0) + (maxPrice !== "" ? 1 : 0),
      clear: () => {
        setMinPrice("");
        setMaxPrice("");
      },
      content: (
        <MinMaxRow>
          <MaskedPriceInput value={minPrice} onChange={setMinPrice} placeholder={t("filters.min")} className={`w-full ${inputBaseClass}`} />
          <MaskedPriceInput value={maxPrice} onChange={setMaxPrice} placeholder={t("filters.max")} className={`w-full ${inputBaseClass}`} />
        </MinMaxRow>
      ),
    },
    {
      id: "category",
      Icon: Boxes,
      label: t("filters.category"),
      count: category ? 1 : 0,
      clear: () => {
        setCategory("");
        setSlot("");
        setWeaponType("");
      },
      content: (
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            if (e.target.value !== ItemCategory.ARMOR && e.target.value !== ItemCategory.CARD) setSlot("");
            if (e.target.value !== ItemCategory.WEAPON) setWeaponType("");
          }}
          className={`w-full ${selectClass}`}
        >
          <option value="">{t("filters.all")}</option>
          {Object.values(ItemCategory).map((c) => (
            <option key={c} value={c}>
              {categoryLabel(t, c)}
            </option>
          ))}
        </select>
      ),
    },
    {
      id: "slot",
      Icon: Shield,
      label: t("filters.slot"),
      count: slot ? 1 : 0,
      clear: () => setSlot(""),
      content: (
        <select value={slot} disabled={!showSlot} onChange={(e) => setSlot(e.target.value)} className={`w-full ${selectClass}`}>
          <option value="">{t("filters.any")}</option>
          {Object.values(EquipSlot).map((s) => (
            <option key={s} value={s}>
              {slotLabel(t, s)}
            </option>
          ))}
        </select>
      ),
    },
    {
      id: "weaponType",
      Icon: Sword,
      label: t("filters.weaponType"),
      count: weaponType ? 1 : 0,
      clear: () => setWeaponType(""),
      content: (
        <select value={weaponType} disabled={!showWeaponType} onChange={(e) => setWeaponType(e.target.value)} className={`w-full ${selectClass}`}>
          <option value="">{t("filters.any")}</option>
          {Object.values(WeaponType).map((w) => (
            <option key={w} value={w}>
              {weaponTypeLabel(t, w)}
            </option>
          ))}
        </select>
      ),
    },
    {
      id: "refine",
      Icon: Sparkles,
      label: t("field.refine"),
      count: (refineMin !== "" ? 1 : 0) + (refineMax !== "" ? 1 : 0),
      clear: () => {
        setRefineMin("");
        setRefineMax("");
      },
      content: (
        <MinMaxRow>
          <input type="number" min={0} max={maxRefineLevel} value={refineMin} disabled={!refineFilterEnabled} placeholder={t("filters.min")}
            onChange={(e) => setRefineMin(e.target.value === "" ? "" : Number(e.target.value))} className={`w-full ${inputBaseClass}`} />
          <input type="number" min={0} max={maxRefineLevel} value={refineMax} disabled={!refineFilterEnabled} placeholder={t("filters.max")}
            onChange={(e) => setRefineMax(e.target.value === "" ? "" : Number(e.target.value))} className={`w-full ${inputBaseClass}`} />
        </MinMaxRow>
      ),
    },
    {
      id: "cardSlots",
      Icon: SquareStack,
      label: t("field.cardSlots"),
      count: (cardSlotsMin !== "" ? 1 : 0) + (cardSlotsMax !== "" ? 1 : 0),
      clear: () => {
        setCardSlotsMin("");
        setCardSlotsMax("");
      },
      content: (
        <MinMaxRow>
          <input type="number" min={0} max={cardSlotsFilterMax} value={cardSlotsMin} disabled={!cardSlotsFilterEnabled} placeholder={t("filters.min")}
            onChange={(e) => setCardSlotsMin(e.target.value === "" ? "" : Number(e.target.value))} className={`w-full ${inputBaseClass}`} />
          <input type="number" min={0} max={cardSlotsFilterMax} value={cardSlotsMax} disabled={!cardSlotsFilterEnabled} placeholder={t("filters.max")}
            onChange={(e) => setCardSlotsMax(e.target.value === "" ? "" : Number(e.target.value))} className={`w-full ${inputBaseClass}`} />
        </MinMaxRow>
      ),
    },
    ...(optionsFeatureAvailable && allOptionDefs.length > 0
      ? [
          {
            id: "options",
            Icon: SlidersHorizontal,
            label: t("field.options"),
            count: optionsActive,
            clear: () => setOptionSelections(emptyOptionFilterSelections()),
            content: (
              <div className="flex flex-col gap-2">
                {isBuyFilter && <p className="text-xs italic text-ro-text-muted">{t("filters.buyOptionsHint")}</p>}
                {Array.from({ length: MAX_OPTION_SLOTS }, (_, i) => i + 1).map((slotIndex) => {
                  const index = slotIndex - 1;
                  const sel = optionSelections[index];
                  const statsForSlot = statsBySlot[index];
                  const selectedStat = statsForSlot.find((s) => s.statCode === sel.statCode);
                  const isMinOutOfRange =
                    selectedStat !== undefined && sel.min !== "" && (sel.min < selectedStat.minValue || sel.min > selectedStat.maxValue);
                  const isMaxOutOfRange =
                    selectedStat !== undefined && sel.max !== "" && (sel.max < selectedStat.minValue || sel.max > selectedStat.maxValue);
                  return (
                    <div key={slotIndex} className="flex flex-col gap-1">
                      <select value={sel.statCode} onChange={(e) => handleOptionSelectChange(index, e.target.value)} className={`w-full ${selectClass}`}>
                        <option value="">{t("filters.optionPlaceholder", { slot: slotIndex })}</option>
                        {statsForSlot.map((s) => (
                          <option key={s.statCode} value={s.statCode}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      {sel.statCode && (
                        <div className="flex items-center gap-2">
                          {!isBuyFilter && (
                            <input type="number" placeholder={selectedStat ? String(selectedStat.minValue) : t("filters.min")} value={sel.min}
                              onChange={(e) => handleOptionMinChange(index, e.target.value === "" ? "" : Number(e.target.value))}
                              className={`w-full ${inputBaseClass}`} style={isMinOutOfRange ? { borderColor: "#dc2626" } : undefined} />
                          )}
                          <input type="number"
                            placeholder={selectedStat ? (isBuyFilter ? `${selectedStat.minValue}-${selectedStat.maxValue}` : String(selectedStat.maxValue)) : isBuyFilter ? t("filters.value") : t("filters.max")}
                            value={sel.max}
                            onChange={(e) => handleOptionMaxChange(index, e.target.value === "" ? "" : Number(e.target.value))}
                            className={`w-full ${inputBaseClass}`} style={isMaxOutOfRange ? { borderColor: "#dc2626" } : undefined} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ),
          } satisfies Section,
        ]
      : []),
    {
      id: "poster",
      Icon: User,
      label: t("filters.poster"),
      count: poster ? 1 : 0,
      clear: () => setPoster(null),
      content: (
        <UserPicker key={poster?.id ?? "empty"} selected={poster} onSelect={setPoster} onClear={() => setPoster(null)} />
      ),
    },
  ];

  const totalCount = sections.reduce((n, s) => n + s.count, 0);

  // Secciones abiertas dentro del panel. Por defecto TODAS abiertas —incluidas
  // las que se añaden tras una carga async (p. ej. "options")— así que se tratan
  // como abiertas salvo que el usuario las colapse explícitamente (`?? true`).
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  }
  // Panel (desktop) colapsado a rail o abierto; bottom-sheet en móvil.
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Si el margen no da para el panel embebido (mismo umbral que el layout,
  // 1560px), arrancar en rail: si no, el panel flotaría sobre los resultados
  // nada más cargar. Se hace tras montar para evitar desajuste de hidratación.
  useEffect(() => {
    if (!window.matchMedia("(min-width: 1560px)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(true);
    }
  }, []);

  // El panel es `fixed`, así que al llegar al fondo se solaparía con el footer.
  // Limitamos su altura en cada scroll/resize para que su borde inferior nunca
  // baje del footer (ni del viewport). Antes de medir, cae en la clase CSS.
  const asideRef = useRef<HTMLElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const GAP = 16;
    function update() {
      const aside = asideRef.current;
      if (!aside) return;
      const top = aside.getBoundingClientRect().top;
      const footer = document.querySelector("footer");
      const footerTop = footer ? footer.getBoundingClientRect().top : Infinity;
      const bottomLimit = Math.min(window.innerHeight, footerTop) - GAP;
      setMaxHeight(Math.max(0, bottomLimit - top));
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Al pulsar un icono del rail: abrir el panel y expandir esa sección.
  function openFromRail(id: string) {
    setCollapsed(false);
    setOpenSections((prev) => ({ ...prev, [id]: true }));
  }

  const panelBody = (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-ro-text">{t("filters.toggle")}</span>
        {totalCount > 0 && (
          <button type="button" onClick={clearAll} className="inline-flex items-center gap-1 text-xs text-ro-red hover:underline">
            <X size={12} />
            {t("filters.clearN", { count: totalCount })}
          </button>
        )}
      </div>

      <div className="flex flex-col">
        {sections.map((s) => {
          const open = openSections[s.id] ?? true;
          return (
            <div key={s.id} className="border-t border-ro-panel-border/60 first:border-t-0">
              <div className="flex items-center gap-2 py-2">
                <button type="button" onClick={() => toggleSection(s.id)} aria-expanded={open} className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-ro-text">
                  <s.Icon size={16} className="shrink-0 text-ro-accent" aria-hidden />
                  <span className="flex-1">{s.label}</span>
                  {s.count > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        s.clear();
                      }}
                      title={t("filters.clearSection")}
                      className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ro-accent px-1 text-[10px] font-bold text-ro-accent-contrast"
                    >
                      {s.count}
                    </button>
                  )}
                  <ChevronDown size={14} className={`shrink-0 text-ro-text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                </button>
              </div>
              {open && <div className="pb-3">{s.content}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: fijo en el margen izquierdo. Panel embebido cuando el margen
          da de sí (≳1560px) o flotando sobre los resultados en anchos medios;
          rail al colapsar. Posiciones aproximadas — ajuste fino pendiente. */}
      <aside
        ref={asideRef}
        style={maxHeight !== undefined ? { maxHeight } : undefined}
        className={`fixed top-[9.5rem] z-30 hidden max-h-[calc(100dvh-11rem)] overflow-y-auto min-[1100px]:block ${
          collapsed
            ? "left-[calc(50vw-36.25rem)]"
            : "left-[calc(50vw-32rem)] min-[1560px]:left-[calc(50vw-48.75rem)]"
        }`}
      >
        {collapsed ? (
          <FilterRail sections={sections} onIcon={openFromRail} onExpand={() => setCollapsed(false)} expandLabel={t("filters.expand")} />
        ) : (
          <div className="w-64 rounded-xl border border-ro-panel-border bg-ro-panel p-3 shadow-lg">
            {panelBody}
            <div className="mt-2 flex justify-end border-t border-ro-panel-border/60 pt-2">
              <button type="button" onClick={() => setCollapsed(true)} title={t("filters.collapse")} aria-label={t("filters.collapse")} className="grid h-7 w-7 place-items-center rounded-md text-ro-text-muted hover:bg-ro-panel-alt hover:text-ro-text">
                <ChevronsLeft size={16} />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Móvil: botón "Filtros (N)" + bottom-sheet. */}
      <div className="mb-3 min-[1100px]:hidden">
        <button type="button" onClick={() => setSheetOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-ro-panel-border bg-ro-panel-alt px-3 py-1.5 text-xs font-medium text-ro-text">
          <SlidersHorizontal size={14} className="text-ro-accent" aria-hidden />
          {t("filters.toggle")}
          {totalCount > 0 && (
            <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-ro-accent px-1 text-[10px] font-bold text-ro-accent-contrast">{totalCount}</span>
          )}
        </button>
        <Drawer side="bottom" open={sheetOpen} onClose={() => setSheetOpen(false)} title={t("filters.toggle")}>
          {panelBody}
        </Drawer>
      </div>
    </>
  );
}

function FilterRail({
  sections,
  onIcon,
  onExpand,
  expandLabel,
}: {
  sections: Section[];
  onIcon: (id: string) => void;
  onExpand: () => void;
  expandLabel: string;
}) {
  return (
    <div className="flex w-14 flex-col items-center gap-2 rounded-xl border border-ro-panel-border bg-ro-panel py-2 shadow-sm">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onIcon(s.id)}
          title={s.label}
          aria-label={s.label}
          className={`relative grid h-9 w-9 place-items-center rounded-lg border ${
            s.count > 0 ? "border-ro-accent bg-ro-accent/10 text-ro-accent" : "border-ro-panel-border bg-ro-panel-alt text-ro-text-muted"
          }`}
        >
          <s.Icon size={18} aria-hidden />
          {s.count > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-ro-accent px-0.5 text-[9px] font-bold text-ro-accent-contrast">
              {s.count}
            </span>
          )}
        </button>
      ))}
      <button type="button" onClick={onExpand} title={expandLabel} aria-label={expandLabel} className="mt-1 grid h-7 w-9 place-items-center rounded-md text-ro-text-muted hover:bg-ro-panel-alt hover:text-ro-text">
        <ChevronsRight size={16} />
      </button>
    </div>
  );
}

function MinMaxRow({ children }: { children: ReactNode }) {
  const [minEl, maxEl] = Array.isArray(children) ? children : [children, null];
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">{minEl}</div>
      <span className="text-ro-text-muted">–</span>
      <div className="flex-1">{maxEl}</div>
    </div>
  );
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}

function toNumberOrEmpty(value: string | null): number | "" {
  if (!value) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}
