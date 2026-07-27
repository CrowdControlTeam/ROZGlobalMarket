import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/Panel";
import { buttonClass } from "@/lib/ui";

// Se renderiza tanto para rutas inexistentes como al llamar a notFound()
// explícitamente (ej. listing/regalo borrado o de otro usuario) — ver
// market/[id]/page.tsx.
export default async function NotFound() {
  const t = await getTranslations("errors.notFound");
  const tNav = await getTranslations("market.nav");

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <Panel>
        <h1 className="font-heading text-lg text-ro-gold">{t("title")}</h1>
        <p className="mt-2 text-sm text-ro-text-muted">{t("message")}</p>
        <Link href="/market" className={`mt-4 inline-flex ${buttonClass("secondary")}`}>
          {tNav("backToMarket")}
        </Link>
      </Panel>
    </main>
  );
}
