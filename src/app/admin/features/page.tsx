import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/Panel";
import { loadMarketConfig } from "@/lib/market-config";
import { fetchGuildRoles } from "@/lib/discord-bot";
import { requireAdmin } from "@/lib/admin-guard";
import { BuildsSettings } from "./BuildsSettings";

// Pestaña "Funcionalidades": configuración por feature, en módulos. De momento
// el módulo de builds (tope por usuario + override por rol). El shell lo pone
// admin/layout.tsx.
export default async function AdminFeaturesPage() {
  await requireAdmin();
  const t = await getTranslations("admin.features");
  const [{ maxBuildsPerUser, buildsRoleId, buildsRoleMax }, guildRolesResult] = await Promise.all([
    loadMarketConfig(),
    fetchGuildRoles(),
  ]);
  const roles = guildRolesResult.status === "ok" ? guildRolesResult.roles : null;

  return (
    <div className="flex flex-col gap-6">
      <Panel title={t("builds.title")}>
        <BuildsSettings
          maxBuildsPerUser={maxBuildsPerUser}
          buildsRoleId={buildsRoleId}
          buildsRoleMax={buildsRoleMax}
          roles={roles}
        />
      </Panel>
    </div>
  );
}
