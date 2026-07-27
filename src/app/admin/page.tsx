import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BarChart3 } from "lucide-react";
import { requireAdmin } from "@/lib/admin-guard";
import { getMarketConfig } from "@/lib/admin-config";
import { Panel } from "@/components/Panel";
import { BackLink } from "@/components/BackLink";
import { buttonClass } from "@/lib/ui";
import { AdminConfigForm } from "./AdminConfigForm";

export default async function AdminPage() {
  await requireAdmin();
  const config = await getMarketConfig();
  const t = await getTranslations("admin");
  const tNav = await getTranslations("market.nav");

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <BackLink href="/market" label={tNav("backToMarket")} />
      <Panel
        title={t("title")}
        headerAction={
          <Link href="/admin/stats" className={buttonClass("secondary")}>
            <BarChart3 size={16} />
            {t("statsLink")}
          </Link>
        }
      >
        <AdminConfigForm config={config} />
      </Panel>
    </main>
  );
}
