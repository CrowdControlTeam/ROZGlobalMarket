"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { selectableJobs } from "@/lib/skill-planner";
import { baseVctMs, computeVct, jobVctSkills, type SectionResult } from "@/lib/vct";
import { buttonClass, inputBaseClass, inputClass, labelClass, selectClass } from "@/lib/ui";
import { ReductionRows, newRow, type ReductionRow } from "./ReductionRows";

// La fórmula, tal cual, para mostrarla arriba (los símbolos matemáticos son
// universales; solo el título/leyenda se traducen).
const FORMULA =
  "VCT = (BaseVCT − Sum_VCT) × (1 − √[(DEX × 2 + INT) ÷ 530]) × (1 − Sum_GearVCTReduc ÷ 100) × (1 − Sum_SkillVCTReduc ÷ 100)";

// SUPERNOVICE / NINJA etc. vienen en mayúsculas en los datos; se muestran en
// Title Case (mismo criterio que el planner).
function titleCase(name: string): string {
  return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
// Parse laxo de inputs numéricos: vacío o inválido → 0.
function num(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
const r3 = (n: number) => String(Math.round(n * 1000) / 1000);
const r2 = (n: number) => String(Math.round(n * 100) / 100);

// Calculadora de Variable Casting Time. Cada grupo de la fórmula es una sección
// con sus inputs y su propio resultado (reducción + VCT); el panel global
// combina las tres reducciones multiplicativas sobre el cast base. Todo en
// cliente, recalculando en vivo. Sin skill elegida → solo porcentajes.
export function VctCalculator() {
  const t = useTranslations("tools.vct");
  const jobs = useMemo(() => selectableJobs(), []);

  const [jobId, setJobId] = useState<number | "">("");
  const [skillId, setSkillId] = useState<number | "">("");
  const [level, setLevel] = useState(1);
  const [dex, setDex] = useState("");
  const [int, setInt] = useState("");
  const [sumFlat, setSumFlat] = useState("");
  const [gearRows, setGearRows] = useState<ReductionRow[]>([newRow()]);
  const [skillRows, setSkillRows] = useState<ReductionRow[]>([newRow()]);

  const skills = useMemo(() => (jobId === "" ? [] : jobVctSkills(jobId)), [jobId]);
  const selectedSkill = skills.find((s) => s.id === skillId);
  const maxLevel = selectedSkill?.max ?? 1;

  const baseVctSec = useMemo(() => {
    if (skillId === "") return null;
    const ms = baseVctMs(skillId, level);
    return ms == null ? null : ms / 1000;
  }, [skillId, level]);

  const gearSum = gearRows.reduce((a, r) => a + num(r.value), 0);
  const skillSum = skillRows.reduce((a, r) => a + num(r.value), 0);

  const result = useMemo(
    () =>
      computeVct({
        baseVctSec,
        sumFlatSec: num(sumFlat),
        dex: num(dex),
        int: num(int),
        gearPct: gearSum,
        skillPct: skillSum,
      }),
    [baseVctSec, sumFlat, dex, int, gearSum, skillSum],
  );

  const hasSkill = skillId !== "";

  function selectJob(v: string) {
    setJobId(v === "" ? "" : Number(v));
    setSkillId("");
    setLevel(1);
  }
  function selectSkill(v: string) {
    if (v === "") {
      setSkillId("");
      return;
    }
    const id = Number(v);
    setSkillId(id);
    setLevel(skills.find((s) => s.id === id)?.max ?? 1); // por defecto, nivel máximo
  }

  // Reset por sección + reset global. Cada sección vuelve a sus valores por
  // defecto (skill/base: sin skill; stats: vacíos; filas: una fila vacía).
  function resetBase() {
    setJobId("");
    setSkillId("");
    setLevel(1);
    setSumFlat("");
  }
  function resetStat() {
    setDex("");
    setInt("");
  }
  function resetGear() {
    setGearRows([newRow()]);
  }
  function resetSkillRed() {
    setSkillRows([newRow()]);
  }
  function resetAll() {
    resetBase();
    resetStat();
    resetGear();
    resetSkillRed();
  }

  return (
    <div>
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-lg text-ro-text">{t("title")}</h1>
          <p className="mt-1 text-sm text-ro-text-muted">{t("subtitle")}</p>
        </div>
        <button type="button" onClick={resetAll} className={`shrink-0 ${buttonClass("outline")}`}>
          <RotateCcw size={16} aria-hidden />
          {t("reset.all")}
        </button>
      </header>

      {/* Fórmula + leyenda: para que se entienda cómo se calcula. */}
      <section className="mb-6 rounded-lg border border-ro-panel-border bg-ro-panel/50 p-4">
        <h2 className="font-heading text-sm text-ro-text">{t("formula.title")}</h2>
        <div className="mt-2 overflow-x-auto">
          <code className="block whitespace-nowrap text-sm text-ro-text">{FORMULA}</code>
        </div>
        <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-ro-text-muted">
          {t("formula.legend")}
        </h3>
        <ul className="space-y-1.5 text-sm text-ro-text-muted">
          {(["baseVct", "flat", "gear", "skill"] as const).map((k) => (
            <li key={k}>
              <span className="font-semibold text-ro-text">{t(`legend.${k}.term`)}</span>
              {" — "}
              {t(`legend.${k}.desc`)}
            </li>
          ))}
        </ul>
      </section>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
        {/* Secciones (inputs) */}
        <div className="flex flex-col gap-4">
          {/* 1) Skill y cast base */}
          <Section title={t("section.base.title")} onReset={resetBase} resetLabel={t("reset.section")}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={labelClass}>{t("field.job")}</label>
                <select
                  value={jobId === "" ? "" : String(jobId)}
                  onChange={(e) => selectJob(e.target.value)}
                  className={`${selectClass} h-10 w-full`}
                >
                  <option value="">{t("field.jobPlaceholder")}</option>
                  <optgroup label={t("field.firstJobs")}>
                    {jobs.first.map((j) => (
                      <option key={j.id} value={j.id}>
                        {titleCase(j.name)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t("field.secondJobs")}>
                    {jobs.second.map((j) => (
                      <option key={j.id} value={j.id}>
                        {titleCase(j.name)}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("field.skill")}</label>
                <select
                  value={skillId === "" ? "" : String(skillId)}
                  onChange={(e) => selectSkill(e.target.value)}
                  disabled={jobId === ""}
                  className={`${selectClass} h-10 w-full`}
                >
                  <option value="">{t("field.skillNone")}</option>
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("field.level")}</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(Number(e.target.value))}
                  disabled={!hasSkill}
                  className={`${selectClass} h-10 w-full`}
                >
                  {Array.from({ length: maxLevel }, (_, i) => i + 1).map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 max-w-[12rem]">
              <label className={labelClass}>{t("field.sumFlat")}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={sumFlat}
                  onChange={(e) => setSumFlat(e.target.value)}
                  placeholder="0"
                  disabled={!hasSkill}
                  className={`w-24 text-right ${inputBaseClass} disabled:opacity-40`}
                />
                <span className="text-sm text-ro-text-muted">s</span>
              </div>
            </div>

            <div className="mt-3 border-t border-ro-panel-border pt-3 text-sm">
              {hasSkill ? (
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <ResultLine label={t("field.baseVct")} value={`${r3(baseVctSec ?? 0)} s`} />
                  <ResultLine
                    label={t("field.reducedBase")}
                    value={`${r3(result.base.reducedBaseSec ?? 0)} s`}
                    strong
                  />
                </div>
              ) : (
                <p className="text-ro-text-muted">{t("section.base.hint")}</p>
              )}
            </div>
          </Section>

          {/* 2) Stats */}
          <Section title={t("section.stat.title")} onReset={resetStat} resetLabel={t("reset.section")}>
            <div className="grid max-w-sm grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t("field.dex")}</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={dex}
                  onChange={(e) => setDex(e.target.value)}
                  placeholder="0"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t("field.int")}</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={int}
                  onChange={(e) => setInt(e.target.value)}
                  placeholder="0"
                  className={inputClass}
                />
              </div>
            </div>
            <SectionResultView t={t} res={result.stat} />
          </Section>

          {/* 3) Reducción por equipo/cartas */}
          <Section title={t("section.gear.title")} onReset={resetGear} resetLabel={t("reset.section")}>
            <ReductionRows rows={gearRows} onChange={setGearRows} sum={gearSum} />
            <SectionResultView t={t} res={result.gear} />
          </Section>

          {/* 4) Reducción por skills/buffs */}
          <Section title={t("section.skillred.title")} onReset={resetSkillRed} resetLabel={t("reset.section")}>
            <ReductionRows rows={skillRows} onChange={setSkillRows} sum={skillSum} />
            <SectionResultView t={t} res={result.skill} />
          </Section>
        </div>

        {/* Resultado global */}
        <aside className="mt-4 lg:mt-0">
          <div className="rounded-xl border-2 border-ro-accent/40 bg-ro-panel p-4 lg:sticky lg:top-8">
            <h2 className="font-heading text-sm text-ro-text">{t("result.title")}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <BigLine label={t("result.totalReduction")} value={`${r2(result.total.reductionPct)}%`} />
              <BigLine label={t("result.totalRemaining")} value={`${r2(result.total.remainingPct)}%`} />
              {hasSkill ? (
                <div className="mt-3 border-t border-ro-panel-border pt-3">
                  <dt className="text-xs uppercase tracking-wide text-ro-text-muted">
                    {t("result.finalCast")}
                  </dt>
                  <dd className="mt-0.5 font-heading text-2xl text-ro-accent">
                    {r3(result.total.finalCastSec ?? 0)} s
                  </dd>
                </div>
              ) : (
                <p className="mt-3 border-t border-ro-panel-border pt-3 text-xs text-ro-text-muted">
                  {t("result.noSkill")}
                </p>
              )}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Card de sección (mismo estilo que las secciones del planner). Con un botón
// opcional para resetear solo esa sección.
function Section({
  title,
  onReset,
  resetLabel,
  children,
}: {
  title: string;
  onReset?: () => void;
  resetLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border-2 border-ro-panel-border bg-ro-panel/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-heading text-sm text-ro-text">{title}</h3>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            aria-label={resetLabel}
            title={resetLabel}
            className="grid h-7 w-7 place-items-center rounded text-ro-text-muted transition-colors hover:bg-ro-panel-border/40 hover:text-ro-text"
          >
            <RotateCcw size={14} aria-hidden />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

// Resultado por sección: reducción %, VCT restante % y —si hay skill— el cast
// aplicando solo esa sección.
function SectionResultView({
  t,
  res,
}: {
  t: ReturnType<typeof useTranslations>;
  res: SectionResult;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-ro-panel-border pt-3 text-sm">
      <ResultLine label={t("result.reduction")} value={`${r2(res.reductionPct)}%`} strong />
      <ResultLine label={t("result.remaining")} value={`${r2(res.remainingPct)}%`} />
      {res.castSec != null && (
        <ResultLine label={t("result.sectionCast")} value={`${r3(res.castSec)} s`} />
      )}
    </div>
  );
}

function ResultLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-ro-text-muted">{label}:</span>
      <span className={strong ? "font-semibold text-ro-text" : "text-ro-text"}>{value}</span>
    </span>
  );
}

function BigLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-ro-text-muted">{label}</dt>
      <dd className="font-semibold text-ro-text">{value}</dd>
    </div>
  );
}
