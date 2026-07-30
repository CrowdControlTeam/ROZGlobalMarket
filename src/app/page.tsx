import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth, signIn } from "@/auth";
import { loadMarketConfig } from "@/lib/market-config";
import { Panel } from "@/components/Panel";
import { DiscordIcon } from "@/components/DiscordIcon";
import { buttonClass } from "@/lib/ui";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  // Un no-admin logueado durante el mantenimiento no debe quedarse en el home
  // ("Ir al mercado" no le llevaría a ningún sitio): a la página de mantenimiento.
  if (session?.user && !session.user.isAdmin) {
    const { maintenanceModeEnabled } = await loadMarketConfig();
    if (maintenanceModeEnabled) redirect("/maintenance");
  }
  // A dónde volver tras el login (lo pone requireSession al perder sesión). Solo
  // rutas relativas del mismo origen, para no abrir un open-redirect.
  const { callbackUrl } = await searchParams;
  const returnTo =
    callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : undefined;
  const t = await getTranslations("home");

  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-6 py-16">
      <Panel title={t("welcome")} className="w-full text-center">
        {session?.user ? (
          <div className="flex flex-col items-center gap-4">
            <p>
              {t.rich("greeting", {
                username: session.user.username,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <Link href="/market" className={buttonClass("primary")}>
              {t("goToMarket")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p>{t("intro")}</p>
            <form
              action={async () => {
                "use server";
                await signIn("discord", returnTo ? { redirectTo: returnTo } : undefined);
              }}
            >
              <button type="submit" className={buttonClass("discord")}>
                <DiscordIcon size={18} />
                {t("signIn")}
              </button>
            </form>
          </div>
        )}
      </Panel>
    </main>
  );
}
