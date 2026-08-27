import { getTranslations } from "next-intl/server";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  bisEntry,
  bisEntryToCombatRole,
  bisEntryToJob,
  bisStage,
  combatRole,
  job,
} from "@/db/schema";
import { requireSession } from "@/lib/guard";
import { canEditBis } from "@/lib/bis";
import { loadMagicalWeaponTypes } from "@/lib/item-options";
import { getItemOptionGroup } from "@/lib/item-options-constants";
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
  const stages = await db.select().from(bisStage).orderBy(desc(bisStage.order));
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

  const [rawEntries, roles, jobs, magicalTypes, canEdit] = await Promise.all([
    db.query.bisEntry.findMany({
      where: eq(bisEntry.stageId, selectedStage.id),
      orderBy: [asc(bisEntry.slot), asc(bisEntry.position)],
      with: {
        item: {
          columns: {
            id: true, name: true, iconUrl: true, category: true, slot: true, weaponType: true, slotCount: true,
          },
        },
        options: {
          orderBy: (o) => asc(o.slotIndex),
          columns: { slotIndex: true, defId: true, minValue: true },
          with: { def: { columns: { label: true, group: true, statCode: true } } },
        },
      },
    }),
    db.select({ id: combatRole.id, label: combatRole.label }).from(combatRole).orderBy(asc(combatRole.order)),
    // El filtro por job es solo de 1st jobs (ver requisitos): en EC son los
    // únicos que hay, y más adelante siguen siendo el eje del filtro.
    db
      .select({ id: job.id, label: job.label })
      .from(job)
      .where(eq(job.tier, "FIRST"))
      .orderBy(asc(job.order)),
    loadMagicalWeaponTypes(),
    canEditBis(),
  ]);

  // roles/jobs de cada entry (m2m): Prisma resolvía `roles`/`jobs` directamente;
  // en Drizzle se traversan las tablas puente uniendo al destino, ordenados por
  // el `order` del rol/job, y se agrupan por entry en JS.
  const entryIds = rawEntries.map((e) => e.id);
  const [roleRows, jobRows] =
    entryIds.length > 0
      ? await Promise.all([
          db
            .select({ entryId: bisEntryToCombatRole.a, id: combatRole.id, label: combatRole.label })
            .from(bisEntryToCombatRole)
            .innerJoin(combatRole, eq(bisEntryToCombatRole.b, combatRole.id))
            .where(inArray(bisEntryToCombatRole.a, entryIds))
            .orderBy(asc(combatRole.order)),
          db
            .select({ entryId: bisEntryToJob.a, id: job.id, label: job.label })
            .from(bisEntryToJob)
            .innerJoin(job, eq(bisEntryToJob.b, job.id))
            .where(inArray(bisEntryToJob.a, entryIds))
            .orderBy(asc(job.order)),
        ])
      : [[], []];
  const rolesByEntry = new Map<string, { id: string; label: string }[]>();
  for (const r of roleRows) {
    const list = rolesByEntry.get(r.entryId) ?? [];
    list.push({ id: r.id, label: r.label });
    rolesByEntry.set(r.entryId, list);
  }
  const jobsByEntry = new Map<string, { id: string; label: string }[]>();
  for (const j of jobRows) {
    const list = jobsByEntry.get(j.entryId) ?? [];
    list.push({ id: j.id, label: j.label });
    jobsByEntry.set(j.entryId, list);
  }

  const entries: BisEntryView[] = rawEntries.map((e) => ({
    id: e.id,
    slot: e.slot,
    note: e.note,
    item: e.item
      ? {
          id: e.item.id,
          name: e.item.name,
          iconUrl: e.item.iconUrl,
          category: e.item.category,
          slot: e.item.slot,
          weaponType: e.item.weaponType,
          optionGroup: getItemOptionGroup(e.item, magicalTypes),
          refineLevel: e.refineLevel ?? 0,
          cardSlots: e.item.slotCount,
        }
      : null,
    // Tipo de arma de un BiS genérico de arma ("cualquier Daga"); null en el
    // resto. Determina el pool físico/mágico en el editor y el texto de la card.
    weaponType: e.weaponType,
    // Grupo del pool de sus options (todas comparten pool); null si no lleva
    // options. Un item concreto también puede tener options.
    optionGroup: e.options[0]?.def.group ?? null,
    options: e.options.map((o) => ({
      slotIndex: o.slotIndex,
      defId: o.defId,
      minValue: o.minValue,
      label: o.def.label,
      statCode: o.def.statCode,
    })),
    roles: rolesByEntry.get(e.id) ?? [],
    jobs: jobsByEntry.get(e.id) ?? [],
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        {heading}
        {stages.length > 1 && (
          <StageSelect stages={stages} selectedKey={selectedStage.key} defaultKey={stages[0].key} />
        )}
      </div>

      <BisBoard
        entries={entries}
        roles={roles}
        jobs={jobs}
        magicalTypes={Array.from(magicalTypes)}
        canEdit={canEdit}
        stageId={selectedStage.id}
      />
    </main>
  );
}
