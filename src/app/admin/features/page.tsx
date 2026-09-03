import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/Panel";
import { loadMarketConfig } from "@/lib/market-config";
import { requireAdmin } from "@/lib/admin-guard";
import { BuildsSettings } from "./BuildsSettings";

// Pestaña "Funcionalidades": configuración por feature, en módulos. De momento
// el módulo de builds (tope por usuario). El shell lo pone admin/layout.tsx.
export default async function AdminFeaturesPage() {
  await requireAdmin();
  const t = await getTranslations("admin.features");
  const { maxBuildsPerUser } = await loadMarketConfig();

  return (
    <div className="flex flex-col gap-6">
      <Panel title={t("builds.title")}>
        <BuildsSettings maxBuildsPerUser={maxBuildsPerUser} />
      </Panel>
    </div>
  );
}
