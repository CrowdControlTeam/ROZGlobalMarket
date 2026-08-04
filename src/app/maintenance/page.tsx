import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Wrench } from "lucide-react";
import { auth } from "@/auth";
import { loadMarketConfig } from "@/lib/market-config";
import { Panel } from "@/components/Panel";
import { buttonClass } from "@/lib/ui";

// Página de mantenimiento. Pública a propósito (NO pasa por requireSession, que
// mandaría aquí en bucle a los no-admin). A ella llega quien no es admin cuando
// el mantenimiento está activo (ver guard.ts). Si el mantenimiento ya no está
// activo, no tiene sentido mostrarla: al mercado.
export default async function MaintenancePage() {
  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (!maintenanceModeEnabled) redirect("/market");

  const session = await auth();
  const isAdmin = session?.user?.isAdmin ?? false;
  const t = await getTranslations("maintenancePage");

  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-6 py-16">
      <Panel title={t("title")} className="w-full text-center">
        <div className="flex flex-col items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-ro-accent/10 text-ro-accent">
            <Wrench size={28} aria-hidden />
          </span>
          <p>{t("message")}</p>
          {isAdmin && (
            <>
              <p className="text-sm text-ro-text-muted">{t("adminNote")}</p>
              <Link href="/market" className={buttonClass("primary")}>
                {t("backToMarket")}
              </Link>
            </>
          )}
        </div>
      </Panel>
    </main>
  );
}
