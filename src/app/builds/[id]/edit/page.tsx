import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/guard";
import { loadMaxRefineLevel } from "@/lib/refine";
import { getAllOptionChoices } from "@/lib/listings";
import { selectableJobs } from "@/lib/skill-planner";
import { getMyBuild } from "@/lib/builds";
import { toEditorSlots } from "@/lib/build-editor-initial";
import { BackLink } from "@/components/BackLink";
import { BuildEditor, type BuildEditorInitial } from "../../BuildEditor";

export const dynamic = "force-dynamic";

function jobOptions() {
  const { first, second } = selectableJobs();
  const pick = (js: { id: number; name: string }[]) => js.map((j) => ({ id: j.id, name: j.name }));
  return { first: pick(first), second: pick(second) };
}

export default async function EditBuildPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const t = await getTranslations("builds.form");
  const [maxRefine, optionDefs, buildRow] = await Promise.all([
    loadMaxRefineLevel(),
    getAllOptionChoices(),
    getMyBuild(id),
  ]);
  if (!buildRow) notFound();

  const initial: BuildEditorInitial = {
    id: buildRow.id,
    name: buildRow.name,
    jobId: buildRow.jobId,
    tags: buildRow.tags,
    notes: buildRow.notes,
    slots: await toEditorSlots(buildRow.entries),
    skillCode: buildRow.skillCode,
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <BackLink href={`/builds/${id}`} label={t("back")} />
      <h1 className="mb-4 text-2xl font-extrabold text-ro-text">{t("editTitle")}</h1>
      <BuildEditor jobs={jobOptions()} maxRefine={maxRefine} optionDefs={optionDefs} initial={initial} />
    </main>
  );
}
