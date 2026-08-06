import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getMarketConfig } from "@/lib/admin-config";
import { Panel } from "@/components/Panel";
import { BackLink } from "@/components/BackLink";
import { AdminConfigForm } from "./AdminConfigForm";

export default async function AdminPage() {
  await requireAdmin();
  const config = await getMarketConfig();
  const t = await getTranslations("admin");
  const tNav = await getTranslations("market.nav");

  // Admin y Estadísticas son ya pantallas separadas (cada una tiene su acceso
  // desde el hub), así que la cabecera de config no enlaza a stats.
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <BackLink href="/market" label={tNav("backToMarket")} />
      <Panel title={t("title")}>
        <AdminConfigForm config={config} />
      </Panel>
    </main>
  );
}
