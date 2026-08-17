// Fallback del slot paralelo @repost cuando no hay estado que resolver (carga
// dura o redirect()/notFound() en el slot `children`). Igual que @edit/@publish,
// sin este default.tsx Next renderiza el 404 en vez de propagar el redirect.
export default function RepostDefault() {
  return null;
}
