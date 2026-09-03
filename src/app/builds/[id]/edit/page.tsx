import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/guard";
import { loadMaxRefineLevel } from "@/lib/refine";
import { getAllOptionChoices } from "@/lib/listings";
import { loadMagicalWeaponTypes, getItemOptionGroup } from "@/lib/item-options";
import { MAX_OPTION_SLOTS, emptyOptionSelections } from "@/lib/item-options-constants";
import { selectableJobs } from "@/lib/skill-planner";
import { getMyBuild } from "@/lib/builds";
import type { BuildSlot } from "@/db/enums";
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
  const [maxRefine, optionDefs, magicalTypes, buildRow] = await Promise.all([
    loadMaxRefineLevel(),
    getAllOptionChoices(),
    loadMagicalWeaponTypes(),
    getMyBuild(id),
  ]);
  if (!buildRow) notFound();

  const slots: BuildEditorInitial["slots"] = {};
  for (const e of buildRow.entries) {
    const options = emptyOptionSelections();
    for (const o of e.options) {
      if (o.slotIndex >= 1 && o.slotIndex <= MAX_OPTION_SLOTS) {
        options[o.slotIndex - 1] = { defId: o.defId, value: o.value };
      }
    }
    const cards: ({ id: string; name: string; iconUrl: string } | null)[] = Array.from(
      { length: e.item.slotCount },
      () => null,
    );
    for (const c of e.cards) {
      if (c.slotIndex >= 0 && c.slotIndex < cards.length) {
        cards[c.slotIndex] = { id: c.card.id, name: c.card.name, iconUrl: c.card.iconUrl };
      }
    }
    slots[e.slot as BuildSlot] = {
      item: {
        id: e.item.id,
        name: e.item.name,
        iconUrl: e.item.iconUrl,
        slotCount: e.item.slotCount,
        optionGroup: getItemOptionGroup(e.item, magicalTypes),
        position: e.item.position,
      },
      refine: e.refineLevel,
      options,
      cards,
    };
  }

  const initial: BuildEditorInitial = {
    id: buildRow.id,
    name: buildRow.name,
    jobId: buildRow.jobId,
    tags: buildRow.tags,
    notes: buildRow.notes,
    slots,
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <BackLink href={`/builds/${id}`} label={t("back")} />
      <h1 className="mb-4 text-2xl font-extrabold text-ro-text">{t("editTitle")}</h1>
      <BuildEditor jobs={jobOptions()} maxRefine={maxRefine} optionDefs={optionDefs} initial={initial} />
    </main>
  );
}
