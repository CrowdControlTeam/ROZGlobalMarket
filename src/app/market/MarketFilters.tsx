"use client";

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
import { MultiSelectFilter } from "./MultiSelectFilter";
import { useMarketSearch } from "./marketSearchStore";

type OptionFilterSelection = { statCode: string; min: number | ""; max: number | "" };

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
  const t = useTranslations("market");
  // El store es la fuente de verdad de los filtros de la pestaña activa; este
  // panel solo lee de `filters` y escribe con setFilter/setFilters. El store
  // serializa a la URL (con debounce) y la URL es lo que lee el servidor.
  const { filters, setFilter, setFilters, mobileFiltersOpen, setMobileFiltersOpen } = useMarketSearch();

  // Metadatos async (no son filtros): límite de refino y catálogo de options.
  const [maxRefineLevel, setMaxRefineLevel] = useState(DEFAULT_MAX_REFINE_LEVEL);
  useEffect(() => {
    getMaxRefineLevel().then(setMaxRefineLevel);
  }, []);
  const [allOptionDefs, setAllOptionDefs] = useState<ItemOptionDef[]>([]);
  const [optionsFeatureAvailable, setOptionsFeatureAvailable] = useState(true);
  useEffect(() => {
    getOptionsFeatureAvailable().then((available) => {
      setOptionsFeatureAvailable(available);
      if (available) getAllOptionChoices().then(setAllOptionDefs);
    });
  }, []);

  // Valores derivados de los filtros de la pestaña activa. El tipo lo fija el
  // SegmentedTypeSelector; aquí solo se lee para adaptar la semántica de las
  // options en BUY.
  const type = filters.type ?? "";
  const poster: UserResult | null =
    filters.posterId && filters.posterName
      ? { id: filters.posterId, username: filters.posterName, avatarUrl: null }
      : null;
  // Multi-valor: en el store viajan como CSV (category=WEAPON,ARMOR); aquí se
  // leen como arrays. El componente MultiSelectFilter devuelve el array ya en
  // orden canónico (el de los Object.values del enum), así que la CSV es estable.
  const categories = parseCsv(filters.category);
  const slots = parseCsv(filters.slot);
  const weaponTypes = parseCsv(filters.weaponType);
  const minPrice = toNumberOrEmpty(filters.minPrice);
  const maxPrice = toNumberOrEmpty(filters.maxPrice);
  const refineMin = filters.refineMin ?? "";
  const refineMax = filters.refineMax ?? "";
  const cardSlotsMin = filters.cardSlotsMin ?? "";
  const cardSlotsMax = filters.cardSlotsMax ?? "";
  const optionSelections: OptionFilterSelection[] = Array.from({ length: MAX_OPTION_SLOTS }, (_, i) => {
    const n = i + 1;
    return {
      statCode: filters[`option${n}Stat`] ?? "",
      min: toNumberOrEmpty(filters[`option${n}Min`]),
      max: toNumberOrEmpty(filters[`option${n}Max`]),
    };
  });

  const statsBySlot = useMemo(() => {
    const bySlot: StatOption[][] = [];
    for (let slotIndex = 1; slotIndex <= MAX_OPTION_SLOTS; slotIndex++) {
      bySlot.push(dedupeByStat(allOptionDefs.filter((d) => d.slotIndex === slotIndex)));
    }
    return bySlot;
  }, [allOptionDefs]);

  // Gating "guiado no destructivo": slot y tipo de arma solo se muestran/aplican
  // cuando ALGUNA categoría elegida los admite (o no hay categoría). Si dejan de
  // aplicar NO se borran del store —quedan en la URL y reaparecen al volver la
  // categoría—; el backend ya los ignora fuera de contexto (ver getListings).
  const isBuyFilter = type === "BUY";
  const noCategory = categories.length === 0;
  const hasArmor = categories.includes(ItemCategory.ARMOR);
  const hasCard = categories.includes(ItemCategory.CARD);
  const hasWeapon = categories.includes(ItemCategory.WEAPON);
  const showSlot = noCategory || hasArmor || hasCard;
  const showWeaponType = noCategory || hasWeapon;
  // Refino/slots de carta: el backend NO los acota por categoría (los aplica sin
  // más), así que aquí sí se limpian al quedar fuera de contexto (ver el efecto
  // de normalización) para no devolver 0 resultados; su enabled se deriva de si
  // hay arma, o armadura con algún slot elegido compatible (o sin slot).
  const armorRefineEligible =
    hasArmor &&
    (slots.length === 0 || slots.some((s) => isRefineEligible({ category: ItemCategory.ARMOR, slot: s as EquipSlot })));
  const refineFilterEnabled = noCategory || hasWeapon || armorRefineEligible;
  const armorCardSlotsEligible =
    hasArmor &&
    (slots.length === 0 || slots.some((s) => getMaxCardSlots({ category: ItemCategory.ARMOR, slot: s as EquipSlot }) > 0));
  const cardSlotsFilterEnabled = noCategory || hasWeapon || armorCardSlotsEligible;
  const cardSlotsFilterMax =
    !noCategory && hasArmor && !hasWeapon && slots.length > 0
      ? Math.max(1, ...slots.map((s) => getMaxCardSlots({ category: ItemCategory.ARMOR, slot: s as EquipSlot })))
      : MAX_WEAPON_CARD_SLOTS;

  // Normalización: al cambiar categoría/slot/tipo, limpia del store los filtros
  // dependientes que dejan de aplicar (equivale al "drop" condicional que antes
  // hacía el efecto de aplicar). Solo escribe si hay algo que limpiar (evita
  // bucle: tras limpiar ya no queda nada que limpiar).
  useEffect(() => {
    const patch: Record<string, string> = {};
    if (!refineFilterEnabled) {
      if (filters.refineMin) patch.refineMin = "";
      if (filters.refineMax) patch.refineMax = "";
    }
    if (!cardSlotsFilterEnabled) {
      if (filters.cardSlotsMin) patch.cardSlotsMin = "";
      if (filters.cardSlotsMax) patch.cardSlotsMax = "";
    }
    if (isBuyFilter) {
      for (let n = 1; n <= MAX_OPTION_SLOTS; n++) if (filters[`option${n}Min`]) patch[`option${n}Min`] = "";
    }
    if (Object.keys(patch).length > 0) setFilters(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refineFilterEnabled, cardSlotsFilterEnabled, isBuyFilter, filters]);

  // Multi-valor → CSV en el store. Array vacío ⇒ "" ⇒ el store elimina la clave
  // (y con ella el parámetro de la URL). El array llega ya en orden canónico.
  function setCsvFilter(key: string, values: string[]) {
    setFilter(key, values.join(","));
  }
  function handleOptionSelectChange(index: number, statCode: string) {
    const n = index + 1;
    setFilters({ [`option${n}Stat`]: statCode, [`option${n}Min`]: "", [`option${n}Max`]: "" });
  }
  function handleOptionMinChange(index: number, value: string) {
    setFilter(`option${index + 1}Min`, value);
  }
  function handleOptionMaxChange(index: number, value: string) {
    setFilter(`option${index + 1}Max`, value);
  }

  function clearAll() {
    const patch: Record<string, string> = {
      posterId: "",
      posterName: "",
      category: "",
      slot: "",
      weaponType: "",
      minPrice: "",
      maxPrice: "",
      refineMin: "",
      refineMax: "",
      cardSlotsMin: "",
      cardSlotsMax: "",
    };
    for (let n = 1; n <= MAX_OPTION_SLOTS; n++) {
      patch[`option${n}Stat`] = "";
      patch[`option${n}Min`] = "";
      patch[`option${n}Max`] = "";
    }
    setFilters(patch);
  }

  function clearOptions() {
    const patch: Record<string, string> = {};
    for (let n = 1; n <= MAX_OPTION_SLOTS; n++) {
      patch[`option${n}Stat`] = "";
      patch[`option${n}Min`] = "";
      patch[`option${n}Max`] = "";
    }
    setFilters(patch);
  }

  const optionsActive = optionSelections.filter((s) => s.statCode !== "").length;
  const sections: Section[] = [
    {
      id: "price",
      Icon: Coins,
      label: t("filters.priceSection"),
      count: (minPrice !== "" ? 1 : 0) + (maxPrice !== "" ? 1 : 0),
      clear: () => setFilters({ minPrice: "", maxPrice: "" }),
      content: (
        <MinMaxRow>
          <MaskedPriceInput
            value={minPrice}
            onChange={(v) => setFilter("minPrice", v === "" ? "" : String(v))}
            placeholder={t("filters.min")}
            className={`w-full ${inputBaseClass}`}
          />
          <MaskedPriceInput
            value={maxPrice}
            onChange={(v) => setFilter("maxPrice", v === "" ? "" : String(v))}
            placeholder={t("filters.max")}
            className={`w-full ${inputBaseClass}`}
          />
        </MinMaxRow>
      ),
    },
    {
      id: "category",
      Icon: Boxes,
      label: t("filters.category"),
      count: categories.length,
      // No destructivo: limpiar categoría no toca slot/tipo de arma (el backend
      // los ignora fuera de contexto y reaparecen al volver la categoría).
      clear: () => setFilter("category", ""),
      content: (
        <MultiSelectFilter
          options={Object.values(ItemCategory).map((c) => ({ value: c, label: categoryLabel(t, c) }))}
          selected={categories}
          onChange={(next) => setCsvFilter("category", next)}
          placeholder={t("filters.all")}
        />
      ),
    },
    {
      id: "slot",
      Icon: Shield,
      label: t("filters.slot"),
      count: slots.length,
      clear: () => setFilter("slot", ""),
      content: (
        <MultiSelectFilter
          options={Object.values(EquipSlot).map((s) => ({ value: s, label: slotLabel(t, s) }))}
          selected={slots}
          onChange={(next) => setCsvFilter("slot", next)}
          disabled={!showSlot}
          placeholder={t("filters.any")}
        />
      ),
    },
    {
      id: "weaponType",
      Icon: Sword,
      label: t("filters.weaponType"),
      count: weaponTypes.length,
      clear: () => setFilter("weaponType", ""),
      content: (
        <MultiSelectFilter
          options={Object.values(WeaponType).map((w) => ({ value: w, label: weaponTypeLabel(t, w) }))}
          selected={weaponTypes}
          onChange={(next) => setCsvFilter("weaponType", next)}
          disabled={!showWeaponType}
          placeholder={t("filters.any")}
        />
      ),
    },
    {
      id: "refine",
      Icon: Sparkles,
      label: t("field.refine"),
      count: (refineMin !== "" ? 1 : 0) + (refineMax !== "" ? 1 : 0),
      clear: () => setFilters({ refineMin: "", refineMax: "" }),
      content: (
        <MinMaxRow>
          <input type="number" min={0} max={maxRefineLevel} value={refineMin} disabled={!refineFilterEnabled} placeholder={t("filters.min")}
            onChange={(e) => setFilter("refineMin", e.target.value)} className={`w-full ${inputBaseClass}`} />
          <input type="number" min={0} max={maxRefineLevel} value={refineMax} disabled={!refineFilterEnabled} placeholder={t("filters.max")}
            onChange={(e) => setFilter("refineMax", e.target.value)} className={`w-full ${inputBaseClass}`} />
        </MinMaxRow>
      ),
    },
    {
      id: "cardSlots",
      Icon: SquareStack,
      label: t("field.cardSlots"),
      count: (cardSlotsMin !== "" ? 1 : 0) + (cardSlotsMax !== "" ? 1 : 0),
      clear: () => setFilters({ cardSlotsMin: "", cardSlotsMax: "" }),
      content: (
        <MinMaxRow>
          <input type="number" min={0} max={cardSlotsFilterMax} value={cardSlotsMin} disabled={!cardSlotsFilterEnabled} placeholder={t("filters.min")}
            onChange={(e) => setFilter("cardSlotsMin", e.target.value)} className={`w-full ${inputBaseClass}`} />
          <input type="number" min={0} max={cardSlotsFilterMax} value={cardSlotsMax} disabled={!cardSlotsFilterEnabled} placeholder={t("filters.max")}
            onChange={(e) => setFilter("cardSlotsMax", e.target.value)} className={`w-full ${inputBaseClass}`} />
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
            clear: clearOptions,
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
                              onChange={(e) => handleOptionMinChange(index, e.target.value)}
                              className={`w-full ${inputBaseClass}`} style={isMinOutOfRange ? { borderColor: "#dc2626" } : undefined} />
                          )}
                          <input type="number"
                            placeholder={selectedStat ? (isBuyFilter ? `${selectedStat.minValue}-${selectedStat.maxValue}` : String(selectedStat.maxValue)) : isBuyFilter ? t("filters.value") : t("filters.max")}
                            value={sel.max}
                            onChange={(e) => handleOptionMaxChange(index, e.target.value)}
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
      clear: () => setFilters({ posterId: "", posterName: "" }),
      content: (
        <UserPicker
          key={poster?.id ?? "empty"}
          selected={poster}
          onSelect={(u) => setFilters({ posterId: u.id, posterName: u.username })}
          onClear={() => setFilters({ posterId: "", posterName: "" })}
        />
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
  // Panel (desktop) colapsado a rail o abierto. El bottom-sheet móvil se controla
  // desde el store (mobileFiltersOpen); el disparador vive en la cabecera.
  const [collapsed, setCollapsed] = useState(false);

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
              {/* El botón de colapsar (etiqueta) y el badge de limpiar son
                  HERMANOS, no anidados: un <button> dentro de otro es HTML
                  inválido y rompe la hidratación. */}
              <div className="flex items-center gap-2 py-2">
                <button type="button" onClick={() => toggleSection(s.id)} aria-expanded={open} className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-ro-text">
                  <s.Icon size={16} className="shrink-0 text-ro-accent" aria-hidden />
                  <span className="flex-1">{s.label}</span>
                </button>
                {s.count > 0 && (
                  <button
                    type="button"
                    onClick={s.clear}
                    title={t("filters.clearSection")}
                    className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-ro-accent px-1 text-[10px] font-bold text-ro-accent-contrast"
                  >
                    {s.count}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleSection(s.id)}
                  aria-label={open ? t("filters.collapse") : t("filters.expand")}
                  className="grid shrink-0 place-items-center text-ro-text-muted"
                >
                  <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
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

      {/* Móvil: bottom-sheet de filtros. El disparador (icono "Filtros") está en
          la cabecera de resultados; aquí solo vive el panel. */}
      <Drawer side="bottom" open={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)} title={t("filters.toggle")}>
        {panelBody}
      </Drawer>
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

function parseCsv(value: string | null | undefined): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

function toNumberOrEmpty(value: string | null | undefined): number | "" {
  if (!value) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}
