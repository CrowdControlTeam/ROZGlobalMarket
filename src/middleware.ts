import { NextResponse, type NextRequest } from "next/server";

// Expone la ruta actual (pathname+query) a los server components mediante un
// header de request (x-pathname). App Router no da el pathname en el servidor, y
// lo necesitamos para recordar a dónde volver tras reloguearse (callbackUrl, ver
// requireSession en guard.ts y el home en page.tsx). Es el patrón estándar para
// esto. Sin DB ni auth: corre bien en el Edge/Workers.
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Todas las rutas salvo los assets internos de Next y el favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
