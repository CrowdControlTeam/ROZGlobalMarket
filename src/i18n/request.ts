import { getRequestConfig } from "next-intl/server";
import { loadMarketConfig } from "@/lib/market-config";

// Sin locale routing (norma: un único idioma activo para toda la app, no
// una preferencia por usuario ni por URL) — el locale sale de
// MarketConfig.locale, editable desde /admin (ver src/lib/locale-constants.ts).
export default getRequestConfig(async () => {
  const { locale } = await loadMarketConfig();

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
