import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/Panel";

export default async function AuthErrorPage() {
  const t = await getTranslations("authError");

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <Panel title={t("title")} className="text-center">
        <div className="flex flex-col items-center gap-4">
          <p>{t("message")}</p>
          <Link href="/" className="text-ro-gold-dark underline hover:text-ro-gold">
            {t("backHome")}
          </Link>
        </div>
      </Panel>
    </main>
  );
}
