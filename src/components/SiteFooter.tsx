import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("market");
  return (
    <footer className="border-t-4 border-ro-panel-border bg-ro-bg-alt py-4 text-center text-xs text-ro-text-light/70">
      <p>{t("footerDisclaimer")}</p>
    </footer>
  );
}
