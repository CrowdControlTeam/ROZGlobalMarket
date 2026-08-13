import { getTranslations } from "next-intl/server";

// Placeholder de la pestaña Skills (skill planner) — se construye en la Fase 2.
export default async function DbSkillsPage() {
  const t = await getTranslations("db.skills");
  return (
    <div className="rounded-lg border-2 border-dashed border-ro-panel-border p-12 text-center">
      <p className="text-sm text-ro-text-muted">{t("comingSoon")}</p>
    </div>
  );
}
