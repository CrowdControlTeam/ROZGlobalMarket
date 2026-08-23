import { getTranslations } from "next-intl/server";
import { auth, signIn } from "@/auth";
import { loadHomeImage } from "@/lib/market-config";
import { Panel } from "@/components/Panel";
import { Hub } from "@/components/Hub";
import { DiscordIcon } from "@/components/DiscordIcon";
import { buttonClass } from "@/lib/ui";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();

  // Con sesión: hub de inicio (accesos directos a las secciones). El hub sigue
  // accesible en mantenimiento (solo se cierra el mercado); desde aquí se puede
  // ir a BiS/DB. Cuenta, admin, tema e idioma viven en el menú de usuario.
  if (session?.user) {
    const homeImageUrl = await loadHomeImage();
    return (
      <Hub
        username={session.user.username}
        isAdmin={session.user.isAdmin}
        homeImageUrl={homeImageUrl}
      />
    );
  }

  // Sin sesión: login con Discord. returnTo = a dónde volver tras entrar (lo
  // pone requireSession al perder sesión); solo rutas relativas del mismo
  // origen, para no abrir un open-redirect.
  const { callbackUrl } = await searchParams;
  const returnTo =
    callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : undefined;
  const t = await getTranslations("home");

  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-6 py-16">
      <Panel title={t("welcome")} className="w-full text-center">
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
      </Panel>
    </main>
  );
}
