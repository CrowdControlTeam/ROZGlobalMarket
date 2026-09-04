"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Minus, Plus, X } from "lucide-react";
import { RoDescription } from "@/components/RoDescription";
import { effLevel, getSkill, prereqsOf, type Levels, type PlannerCtx } from "@/lib/skill-planner";

// Detalle de una skill en modal (al hacer click). Cierra con la X, click en el
// fondo o Escape. Los +/- cambian el nivel (con la misma lógica de cascada).
export function SkillModal({
  id,
  levels,
  ctx,
  onChange,
  onClose,
}: {
  id: number;
  levels: Levels;
  ctx: PlannerCtx;
  onChange: (id: number, target: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("db.skills");
  const skill = getSkill(id);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!skill) return null;
  const lv = effLevel(id, levels);
  const prereqs = prereqsOf(id, ctx);

  // --- Info de detalle (stats de combate/coste). Todo al nivel seleccionado:
  // los campos por-nivel se indexan por `lv` (o Lv1 si aún no está aprendida). ---
  const st = skill.stats;
  const atLv = (v?: number | number[]): number | undefined =>
    v == null ? undefined : Array.isArray(v) ? v[Math.min(Math.max(lv, 1), v.length) - 1] : v;
  const secs = (ms?: number): string | null => (ms == null ? null : (ms / 1000).toFixed(1));

  // Enums traducibles con fallback al valor crudo si aparece uno no mapeado.
  const KNOWN: Record<string, Set<string>> = {
    skillType: new Set(["Magic", "Weapon", "Misc"]),
    target: new Set(["Attack", "Self", "Ground", "Support", "Trap"]),
    element: new Set(["Neutral", "Water", "Earth", "Fire", "Wind", "Poison", "Holy", "Shadow", "Ghost", "Undead"]),
  };
  const enumLabel = (ns: "skillType" | "target" | "element", v?: string) =>
    v ? (KNOWN[ns].has(v) ? t(`${ns}.${v}`) : v) : null;

  const subtitle =
    [enumLabel("skillType", st?.type), enumLabel("element", st?.element), enumLabel("target", st?.target)]
      .filter(Boolean)
      .join(" · ") || skill.type;

  // Rejilla de combate (solo las celdas con dato).
  const combat: { label: string; value: string }[] = [];
  if (st?.range) combat.push({ label: t("skillStats.range"), value: String(st.range) });
  const hitsNow = atLv(st?.hits);
  if (hitsNow) combat.push({ label: t("skillStats.hits"), value: String(hitsNow) });
  const splashNow = atLv(st?.splash);
  if (splashNow) combat.push({ label: t("skillStats.area"), value: `${splashNow * 2 + 1}×${splashNow * 2 + 1}` });
  const castNow = secs(atLv(st?.castVar));
  const castFixed = secs(st?.castFixed);
  if (castNow) combat.push({ label: t("skillStats.cast"), value: castFixed && castFixed !== "0.0" ? `${castNow}s +${castFixed}` : `${castNow}s` });
  const afterCast = secs(st?.afterCast);
  if (afterCast) combat.push({ label: t("skillStats.delay"), value: `${afterCast}s` });
  const cooldown = secs(st?.cooldown);
  if (cooldown) combat.push({ label: t("skillStats.cooldown"), value: `${cooldown}s` });

  // Chips de coste (SP primero, luego el resto).
  const costChips: { key: string; text: string; accent?: boolean }[] = [];
  const spNow = skill.sp ? atLv(skill.sp) : undefined;
  if (spNow != null) costChips.push({ key: "sp", text: `${t("spCost")} ${spNow}`, accent: true });
  const c = st?.cost;
  const hpNow = atLv(c?.hp);
  if (hpNow) costChips.push({ key: "hp", text: `${t("skillStats.hp")} ${hpNow}` });
  const zenyNow = atLv(c?.zeny);
  if (zenyNow) costChips.push({ key: "zeny", text: `${t("skillStats.zeny")} ${zenyNow}` });
  if (c?.spirit) costChips.push({ key: "sph", text: t("skillStats.spirit", { n: c.spirit }) });
  if (c?.ammo) costChips.push({ key: "ammo", text: t("skillStats.ammo") });
  if (c?.weapon?.length) costChips.push({ key: "wp", text: `${t("skillStats.weapon")}: ${c.weapon.join(" / ")}` });
  if (c?.state) costChips.push({ key: "state", text: `${t("skillStats.state")}: ${c.state}` });
  if (c?.status?.length) costChips.push({ key: "sts", text: c.status.join(", ") });
  c?.items?.forEach((it, i) => costChips.push({ key: `it${i}`, text: `${it.amount}× ${it.name}` }));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-3 top-3 text-ro-text-muted hover:text-ro-text"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <Image
            src={`/icons/skills/${id}.png`}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded border border-ro-panel-border"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-heading text-sm leading-tight text-ro-text">{skill.name}</h3>
            <p className="mt-0.5 text-xs text-ro-text-muted">{subtitle}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-md bg-ro-panel-alt/50 px-3 py-2">
          <span className="text-xs text-ro-text-muted">
            {t("level")} <span className="tabular-nums text-ro-text">{lv}</span> / {skill.max}
          </span>
          {skill.pre ? (
            <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[11px] font-semibold text-violet-400">
              {t("platinum")}
            </span>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={t("decrease")}
                onClick={() => onChange(id, lv - 1)}
                disabled={lv <= 0}
                className="flex h-7 w-7 items-center justify-center rounded border-2 border-ro-panel-border hover:enabled:border-ro-accent disabled:opacity-30"
              >
                <Minus size={14} />
              </button>
              <button
                type="button"
                aria-label={t("increase")}
                onClick={() => onChange(id, lv + 1)}
                disabled={lv >= skill.max}
                className="flex h-7 w-7 items-center justify-center rounded border-2 border-ro-panel-border hover:enabled:border-ro-accent disabled:opacity-30"
              >
                <Plus size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Rejilla de combate (valores al nivel seleccionado). Solo en el detalle,
            nunca en el tooltip de hover. */}
        {combat.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {combat.map((s) => (
              <div key={s.label} className="rounded-md bg-ro-panel-alt/50 px-2.5 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-ro-text-muted">{s.label}</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-ro-text">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {costChips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {costChips.map((chip) => (
              <span
                key={chip.key}
                className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                  chip.accent ? "bg-ro-accent/15 text-ro-accent" : "bg-ro-panel-alt/60 text-ro-text-muted"
                }`}
              >
                {chip.text}
              </span>
            ))}
          </div>
        )}

        {prereqs.length > 0 && (
          <p className="mt-2 text-xs text-ro-text-muted">
            {t("requires")}:{" "}
            {prereqs.map((p) => `${getSkill(p.id)?.name ?? p.id} ${t("lvShort")}${p.lv}`).join(", ")}
          </p>
        )}

        {skill.desc.length > 0 && (
          <div className="mt-3 rounded-md border border-ro-panel-border/60 bg-ro-panel-alt/40 p-3">
            <RoDescription lines={skill.desc} />
          </div>
        )}
      </div>
    </div>
  );
}
