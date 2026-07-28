import { getRequestConfig } from "next-intl/server";
import { loadMarketConfig } from "@/lib/market-config";
import type { AppLocale } from "@/lib/locale-constants";
import es from "../../messages/es.json";
import en from "../../messages/en.json";

// Sin locale routing (norma: un único idioma activo para toda la app, no
// una preferencia por usuario ni por URL) — el locale sale de
// MarketConfig.locale, editable desde /admin (ver src/lib/locale-constants.ts).
//
// Los mensajes se importan de forma ESTÁTICA (bundleados) y se eligen por
// locale. No se usa `import(`../../messages/${locale}.json`)` con path
// variable: webpack lo convierte en un context module que en runtime lista el
// directorio con fs.readdir, y en Cloudflare Workers fs.readdir no está
// implementado (unenv) — daba 500 en cada petición.
const MESSAGES: Record<AppLocale, typeof es> = { es, en };

export default getRequestConfig(async () => {
  const { locale } = await loadMarketConfig();

  return {
    locale,
    messages: MESSAGES[locale],
  };
});
