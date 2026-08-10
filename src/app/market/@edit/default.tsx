// Fallback del slot paralelo @edit cuando no hay estado que resolver (carga
// dura o redirect()/notFound() en el slot `children`). Igual que @publish, sin
// este default.tsx Next renderiza el 404 en vez de propagar el redirect (p. ej.
// /market sin sesión debe llevar al login, no a "No encontrado").
export default function EditDefault() {
  return null;
}
