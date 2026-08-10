import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { BisBoard, type BisEntryView } from "./BisBoard";

// Visible para cualquier usuario logueado (no solo admins), como el resto de la
// app: requiere sesión. Solo lectura en esta fase; crear/editar (gated por
// canEditBis: admin o rol) llega en la fase 3.
export const dynamic = "force-dynamic";

export default async function BisPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  await requireSession();
  const { stage: stageParam } = await searchParams;
  const t = await getTranslations("bis");

  // Etapas ordenadas de más reciente a más antigua: la primera es la de por
  // defecto; ?stage=<key> permite ver una anterior.
  const stages = await prisma.bisStage.findMany({ orderBy: { order: "desc" } });
  const selectedStage = stages.find((s) => s.key === stageParam) ?? stages[0] ?? null;

  const header = (
    <header className="mb-6">
      <h1 className="font-heading text-lg tracking-wide text-ro-text">{t("title")}</h1>
      <p className="mt-1 text-sm text-ro-text-muted">{t("subtitle")}</p>
    </header>
  );

  if (!selectedStage) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        {header}
        <p className="text-ro-text-muted">{t("noStages")}</p>
      </main>
    );
  }

  const [rawEntries, roles, jobs] = await Promise.all([
    prisma.bisEntry.findMany({
      where: { stageId: selectedStage.id },
      orderBy: [{ slot: "asc" }, { position: "asc" }],
      include: {
        item: { select: { id: true, name: true, iconUrl: true } },
        options: {
          orderBy: { slotIndex: "asc" },
          select: { slotIndex: true, minValue: true, def: { select: { label: true } } },
        },
        roles: { orderBy: { order: "asc" }, select: { id: true, label: true } },
        jobs: { orderBy: { order: "asc" }, select: { id: true, label: true } },
      },
    }),
    prisma.combatRole.findMany({ orderBy: { order: "asc" }, select: { id: true, label: true } }),
    // El filtro por job es solo de 1st jobs (ver requisitos): en EC son los
    // únicos que hay, y más adelante siguen siendo el eje del filtro.
    prisma.job.findMany({
      where: { tier: "FIRST" },
      orderBy: { order: "asc" },
      select: { id: true, label: true },
    }),
  ]);

  const entries: BisEntryView[] = rawEntries.map((e) => ({
    id: e.id,
    slot: e.slot,
    note: e.note,
    item: e.item
      ? {
          name: e.item.name,
          iconUrl: e.item.iconUrl,
          refineLevel: e.refineLevel ?? 0,
          cardSlots: e.cardSlots ?? 0,
        }
      : null,
    options: e.options.map((o) => ({
      slotIndex: o.slotIndex,
      minValue: o.minValue,
      label: o.def.label,
    })),
    roles: e.roles,
    jobs: e.jobs,
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      {header}

      {stages.length > 1 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ro-text-muted">
            {t("stageLabel")}
          </span>
          {stages.map((s) => {
            const active = s.id === selectedStage.id;
            return (
              <Link
                key={s.id}
                href={s.key === stages[0].key ? "/bis" : `/bis?stage=${encodeURIComponent(s.key)}`}
                aria-current={active ? "true" : undefined}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-ro-accent bg-ro-accent/10 text-ro-accent"
                    : "border-ro-panel-border bg-ro-panel-alt text-ro-text-muted hover:border-ro-accent hover:text-ro-accent"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
      )}

      <BisBoard entries={entries} roles={roles} jobs={jobs} />
    </main>
  );
}
