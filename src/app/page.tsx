import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth, signIn } from "@/auth";
import { Panel } from "@/components/Panel";
import { buttonClass } from "@/lib/ui";

export default async function Home() {
  const session = await auth();
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
                await signIn("discord");
              }}
            >
              <button type="submit" className={buttonClass("discord")}>
                {t("signIn")}
              </button>
            </form>
          </div>
        )}
      </Panel>
    </main>
  );
}
