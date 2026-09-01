"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, Plus } from "lucide-react";
import type { BuildTag } from "@/db/enums";
import { BUILD_TAG_VALUES } from "@/db/enums";
import { getJob, selectableJobs } from "@/lib/skill-planner";
import { ItemIcon } from "@/components/ItemIcon";
import { UserPicker, type UserResult } from "@/components/UserPicker";
import { buttonClass, selectClass } from "@/lib/ui";
import { BuildDetailView, type BuildDetail } from "./BuildDetailView";

type Tab = "all" | "mine";

// Navegador de builds: pestañas (todas / mías) y, dentro, split de dos paneles —
// lista con scroll a la izquierda y detalle de la seleccionada a la derecha. En
// la pestaña "todas" hay filtros por job, etiqueta (PvP/PvE) y usuario. En móvil
// los paneles se apilan: al seleccionar una build, la lista se oculta y aparece
// el detalle con un botón de "volver".
export function BuildsBrowser({
  builds,
  meId,
  availability,
  maxBuildsPerUser,
  myCount,
}: {
  builds: BuildDetail[];
  meId: string;
  availability: Record<string, number>;
  maxBuildsPerUser: number;
  myCount: number;
}) {
  const t = useTranslations("builds");
  const tTag = useTranslations("builds.tags");

  const [tab, setTab] = useState<Tab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fJob, setFJob] = useState<string>("");
  const [fTag, setFTag] = useState<BuildTag | "">("");
  const [fUser, setFUser] = useState<UserResult | null>(null);

  const atLimit = myCount >= maxBuildsPerUser;

  // Todas las clases seleccionables (1ª y 2ª), no solo las que tienen builds.
  const jobs = useMemo(() => selectableJobs(), []);

  const visible = useMemo(() => {
    let list = tab === "mine" ? builds.filter((b) => b.owner.id === meId) : builds;
    if (tab === "all") {
      if (fJob) list = list.filter((b) => String(b.jobId) === fJob);
      if (fTag) list = list.filter((b) => b.tags.includes(fTag));
      if (fUser) list = list.filter((b) => b.owner.id === fUser.id);
    }
    return list;
  }, [builds, tab, meId, fJob, fTag, fUser]);

  const selected = selectedId ? builds.find((b) => b.id === selectedId) ?? null : null;

  function switchTab(next: Tab) {
    setTab(next);
    setSelectedId(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ro-text">{t("title")}</h1>
          <p className="mt-1 text-sm text-ro-text-muted">
            {t("list.myLimit", { n: myCount, max: maxBuildsPerUser })}
          </p>
        </div>
        {!atLimit && (
          <Link href="/builds/new" className={`shrink-0 ${buttonClass("primary")}`}>
            <Plus size={16} aria-hidden />
            {t("list.create")}
          </Link>
        )}
      </div>

      {/* Pestañas */}
      <div className="mb-3 flex gap-1 border-b border-ro-panel-border">
        {(["all", "mine"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => switchTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              tab === key
                ? "border-ro-accent text-ro-accent"
                : "border-transparent text-ro-text-muted hover:text-ro-text"
            }`}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      {/* Filtros (solo en "todas") */}
      {tab === "all" && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={fJob}
            onChange={(e) => setFJob(e.target.value)}
            aria-label={t("filters.job")}
            className={selectClass}
          >
            <option value="">{t("filters.allJobs")}</option>
            <optgroup label={t("form.firstJobs")}>
              {jobs.first.map((j) => (
                <option key={j.id} value={String(j.id)}>
                  {j.name}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("form.secondJobs")}>
              {jobs.second.map((j) => (
                <option key={j.id} value={String(j.id)}>
                  {j.name}
                </option>
              ))}
            </optgroup>
          </select>

          <div className="flex items-center gap-1">
            {BUILD_TAG_VALUES.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFTag((cur) => (cur === tag ? "" : tag))}
                aria-pressed={fTag === tag}
                className={`rounded-md border px-2.5 py-1.5 text-sm font-semibold transition-colors ${
                  fTag === tag
                    ? "border-ro-accent bg-ro-accent/10 text-ro-accent"
                    : "border-ro-panel-border text-ro-text-muted hover:text-ro-text"
                }`}
              >
                {tTag(tag)}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-56">
            <UserPicker
              key={fUser?.id ?? "empty"}
              selected={fUser}
              onSelect={setFUser}
              onClear={() => setFUser(null)}
            />
          </div>
        </div>
      )}

      {/* Split: lista (izq) + detalle (der). Ocupa el alto restante de la página
          (flex-1) y cada panel tiene su propio scroll; la página no scrollea. En
          móvil se apilan y se alterna. */}
      <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-4">
        {/* Lista */}
        <div
          className={`lg:h-full lg:min-h-0 lg:overflow-y-auto ${selectedId ? "hidden lg:block" : "block"}`}
        >
          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ro-panel-border bg-ro-panel-alt px-6 py-10 text-center text-sm text-ro-text-muted">
              {tab === "mine" ? t("list.emptyMine") : t("list.emptyFiltered")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((b) => {
                const active = b.id === selectedId;
                const owner = b.owner.id === meId ? t("list.you") : b.owner.username;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(b.id)}
                      className={`flex w-full flex-col gap-2 rounded-xl border bg-ro-panel p-3 text-left transition-colors ${
                        active ? "border-ro-accent" : "border-ro-panel-border hover:border-ro-accent"
                      }`}
                    >
                      {/* Fila del nombre: nombre a la izquierda y las etiquetas
                          en la esquina superior derecha. */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-bold text-ro-text">{b.name}</p>
                        {b.tags.length > 0 && (
                          <div className="flex shrink-0 flex-wrap justify-end gap-1">
                            {b.tags.map((tag) => (
                              <span key={tag} className="rounded border border-ro-accent/30 bg-ro-accent/10 px-1 py-0.5 text-[0.65rem] text-ro-accent">
                                {tTag(tag)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="truncate text-xs text-ro-text-muted">
                        <span className="font-semibold text-ro-text">{getJob(b.jobId)?.name ?? "—"}</span>
                        <span title={owner}>{" · "}{owner}</span>
                      </p>
                      {/* Iconos de las piezas (hasta 10) en su propia fila,
                          solapados y en una sola línea (nunca saltan de fila). */}
                      {b.entries.length > 0 && (
                        <div className="flex -space-x-1">
                          {b.entries.slice(0, 10).map((e) => (
                            <div key={e.id} className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded border border-ro-panel-border bg-ro-panel-alt">
                              <ItemIcon item={e.item} width={22} height={22} alt="" />
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Detalle / placeholder */}
        <div
          className={`lg:h-full lg:min-h-0 lg:overflow-y-auto ${selectedId ? "block" : "hidden lg:block"}`}
        >
          {selected ? (
            <div className="rounded-xl border border-ro-panel-border bg-ro-panel p-4">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="mb-3 inline-flex items-center gap-1 text-sm text-ro-text-muted hover:text-ro-text lg:hidden"
              >
                <ChevronLeft size={16} aria-hidden />
                {t("list.backToList")}
              </button>
              <BuildDetailView build={selected} meId={meId} availability={availability} />
            </div>
          ) : (
            <div className="grid h-full min-h-[16rem] place-items-center rounded-xl border border-dashed border-ro-panel-border bg-ro-panel-alt px-6 py-10 text-center text-sm text-ro-text-muted">
              {t("list.selectPrompt")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
