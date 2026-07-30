import { NextResponse, type NextRequest } from "next/server";

// Redirección de la URL por defecto del Worker (*.workers.dev) a la URL canónica
// del entorno. Cada Worker (pro / dev) tiene su propio APP_URL como secret
// (dominio en producción, subdominio dev.* en dev), así que este mismo código
// sirve para ambos: si la petición entra por la subdominio-preview de Cloudflare,
// se reenvía al host bueno conservando ruta y query. En el host canónico (o si
// APP_URL no está definido) no hace nada.
//
// Se hace en el Worker a propósito: las Redirect Rules / Bulk Redirects de
// Cloudflare solo actúan sobre zonas propias, y *.workers.dev no lo es.
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const appUrl = process.env.APP_URL;

  if (appUrl && host.endsWith(".workers.dev")) {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, appUrl);
    // 308: redirección permanente que conserva el método. Si durante la puesta
    // en marcha prefieres no cachear en el navegador, cámbialo por 307.
    return NextResponse.redirect(target, 308);
  }

  return NextResponse.next();
}

export const config = {
  // Todas las rutas salvo los assets internos de Next y el favicon: basta con
  // capturar las navegaciones; los assets ya se sirven desde el host canónico
  // una vez redirigida la petición inicial.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
