// Fallback del slot paralelo @detail cuando no hay estado que resolver (carga
// dura, o cuando el slot `children` hace redirect()/notFound()). Sin este
// default.tsx, Next no puede resolver el slot y renderiza el 404 en vez de
// propagar el redirect — p. ej. al entrar a /market sin sesión, que debe llevar
// al login (ver requireSession en guard.ts), no a "No encontrado".
export default function DetailDefault() {
  return null;
}
