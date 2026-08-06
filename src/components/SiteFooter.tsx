import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("market");
  return (
    <footer className="border-t border-ro-panel-border/60 py-5 text-center text-xs text-ro-text-muted">
      <p>{t("footerDisclaimer")}</p>
    </footer>
  );
}
