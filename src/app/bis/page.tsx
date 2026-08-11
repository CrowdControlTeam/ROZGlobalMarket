import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { BisBoard, type BisEntryView } from "./BisBoard";
import { StageSelect } from "./StageSelect";

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

  const heading = (
    <div className="min-w-0">
      <h1 className="font-heading text-lg tracking-wide text-ro-text">{t("title")}</h1>
      <p className="mt-1 text-sm text-ro-text-muted">{t("subtitle")}</p>
    </div>
  );

  if (!selectedStage) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6">{heading}</div>
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
      <div className="mb-6 flex items-start justify-between gap-4">
        {heading}
        {stages.length > 1 && (
          <StageSelect stages={stages} selectedKey={selectedStage.key} defaultKey={stages[0].key} />
        )}
      </div>

      <BisBoard entries={entries} roles={roles} jobs={jobs} />
    </main>
  );
}
