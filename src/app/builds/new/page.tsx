import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/guard";
import { loadMaxRefineLevel } from "@/lib/refine";
import { getAllOptionChoices } from "@/lib/listings";
import { selectableJobs } from "@/lib/skill-planner";
import { BackLink } from "@/components/BackLink";
import { BuildEditor } from "../BuildEditor";

export const dynamic = "force-dynamic";

// Lista de clases (1st/2nd) para el desplegable, acotada a id+name (el resto del
// Job — cells/skills — no hace falta en el cliente).
function jobOptions() {
  const { first, second } = selectableJobs();
  const pick = (js: { id: number; name: string }[]) => js.map((j) => ({ id: j.id, name: j.name }));
  return { first: pick(first), second: pick(second) };
}

export default async function NewBuildPage() {
  await requireSession();
  const t = await getTranslations("builds.form");
  const [maxRefine, optionDefs] = await Promise.all([loadMaxRefineLevel(), getAllOptionChoices()]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <BackLink href="/builds" label={t("back")} />
      <h1 className="mb-4 text-2xl font-extrabold text-ro-text">{t("newTitle")}</h1>
      <BuildEditor jobs={jobOptions()} maxRefine={maxRefine} optionDefs={optionDefs} />
    </main>
  );
}
