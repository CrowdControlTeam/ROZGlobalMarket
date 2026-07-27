import { getTranslations } from "next-intl/server";
import { GiftsHistory } from "@/components/GiftsHistory";

export default async function GiftsPage() {
  const t = await getTranslations("market.gifts");

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 font-heading text-lg text-ro-gold">{t("title")}</h1>
      <GiftsHistory />
    </main>
  );
}
