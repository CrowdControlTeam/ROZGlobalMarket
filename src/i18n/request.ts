import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from "@/lib/locale-constants";
import es from "../../messages/es.json";
import en from "../../messages/en.json";

// Sin locale routing (no hay prefijo de idioma en la URL): el idioma es una
// preferencia POR USUARIO guardada en la cookie `NEXT_LOCALE` (igual que el
// tema), no un ajuste global de /admin. Cada quien lo ve en el idioma que elija
// desde el menú de usuario (ver LocaleSwitcher.tsx). Si la cookie no existe o
// trae un valor no soportado, se cae al idioma por defecto.
//
// Los mensajes se importan de forma ESTÁTICA (bundleados) y se eligen por
// locale. No se usa `import(`../../messages/${locale}.json`)` con path
// variable: webpack lo convierte en un context module que en runtime lista el
// directorio con fs.readdir, y en Cloudflare Workers fs.readdir no está
// implementado (unenv) — daba 500 en cada petición.
const MESSAGES: Record<AppLocale, typeof es> = { es, en };

export default getRequestConfig(async () => {
  const cookie = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale: AppLocale = cookie && isAppLocale(cookie) ? cookie : DEFAULT_LOCALE;

  return {
    locale,
    messages: MESSAGES[locale],
  };
});
