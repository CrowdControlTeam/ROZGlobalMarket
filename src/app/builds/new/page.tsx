import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/guard";
import { loadMaxRefineLevel } from "@/lib/refine";
import { getAllOptionChoices } from "@/lib/listings";
import { selectableJobs } from "@/lib/skill-planner";
import { getBuildForDuplicate } from "@/lib/builds";
import { toEditorSlots } from "@/lib/build-editor-initial";
import { BackLink } from "@/components/BackLink";
import { BuildEditor, type BuildEditorInitial } from "../BuildEditor";

export const dynamic = "force-dynamic";

// Lista de clases (1st/2nd) para el desplegable, acotada a id+name (el resto del
// Job — cells/skills — no hace falta en el cliente).
function jobOptions() {
  const { first, second } = selectableJobs();
  const pick = (js: { id: number; name: string }[]) => js.map((j) => ({ id: j.id, name: j.name }));
  return { first: pick(first), second: pick(second) };
}

// Crear una build nueva. Con `?from=<id>` se DUPLICA otra build (de cualquiera):
// se precarga el editor con todos sus datos MENOS el nombre y, al Guardar, se
// crea una build nueva del usuario actual (nada se persiste hasta entonces). Sin
// `id` en el initial, el editor guarda como creación, no como edición.
export default async function NewBuildPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireSession();
  const { from } = await searchParams;
  const t = await getTranslations("builds.form");
  const [maxRefine, optionDefs, source] = await Promise.all([
    loadMaxRefineLevel(),
    getAllOptionChoices(),
    from ? getBuildForDuplicate(from) : Promise.resolve(null),
  ]);

  // Precarga de duplicado (si el origen existe): SOLO los items (con su refino/
  // options/cartas) y la clase. Nombre, tags, notas y skills NO se copian — el
  // usuario los pone de nuevo antes de guardar. Sin id → se guarda como creación.
  const initial: BuildEditorInitial | undefined = source
    ? {
        name: "",
        jobId: source.jobId,
        tags: [],
        notes: null,
        slots: await toEditorSlots(source.entries),
        skillCode: null,
      }
    : undefined;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <BackLink href="/builds" label={t("back")} />
      <h1 className="mb-4 text-2xl font-extrabold text-ro-text">
        {initial ? t("duplicateTitle") : t("newTitle")}
      </h1>
      <BuildEditor jobs={jobOptions()} maxRefine={maxRefine} optionDefs={optionDefs} initial={initial} />
    </main>
  );
}
