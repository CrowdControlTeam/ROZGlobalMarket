import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/guard";

// Placeholder de la sección Builds (Fase 1: solo el corte de schema). El editor
// y el listado llegan en fases siguientes. requireSession (no el de mercado):
// /builds sigue abierto en modo mantenimiento, como estaba /bis.
export const dynamic = "force-dynamic";

export default async function BuildsPage() {
  await requireSession();
  const t = await getTranslations("builds");
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-extrabold text-ro-text">{t("title")}</h1>
      <p className="mt-2 text-ro-text-muted">{t("subtitle")}</p>
      <p className="mt-8 rounded-xl border border-dashed border-ro-panel-border bg-ro-panel-alt px-6 py-10 text-center text-ro-text-muted">
        {t("comingSoon")}
      </p>
    </main>
  );
}
