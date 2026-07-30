import { getTranslations } from "next-intl/server";
import pkg from "../../package.json";

// The displayed version is the single source of truth: package.json (bumped by
// the "Prepare release" workflow and tagged from it — see .github/workflows).
// On the dev Worker (APP_ENV=dev, set in wrangler.jsonc) it gets a "-dev" suffix
// so it's obvious you're not on production. Locally APP_ENV is unset -> no suffix.
const version = `v${pkg.version}${process.env.APP_ENV === "dev" ? "-dev" : ""}`;

export async function SiteFooter() {
  const t = await getTranslations("market");
  return (
    <footer className="border-t-4 border-ro-panel-border bg-ro-bg-alt py-4 text-center text-xs text-ro-text-light/70">
      <p>{t("footerDisclaimer")}</p>
      <p className="mt-1 font-mono text-[0.65rem] text-ro-text-light/40">{version}</p>
    </footer>
  );
}
