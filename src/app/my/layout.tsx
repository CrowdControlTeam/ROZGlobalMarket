import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/guard";
import { BackLink } from "@/components/BackLink";
import { MyActivityTabs } from "@/components/MyActivityTabs";

export default async function MyActivityLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const t = await getTranslations("myActivity");
  const tNav = await getTranslations("market.nav");

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/market" label={tNav("backToMarket")} />
      <h1 className="mb-6 font-heading text-lg text-ro-gold">{t("title")}</h1>
      <MyActivityTabs />
      {children}
    </main>
  );
}
