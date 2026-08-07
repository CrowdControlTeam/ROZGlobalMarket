// Igual que @publish/default.tsx pero para las sub-rutas del mercado
// (/market/[id], /market/new…): evita el 404 de parallel routes en producción
// cuando el slot `children` de una sub-ruta hace redirect()/notFound() (p. ej.
// sin sesión → login). Ver comentario en @publish/default.tsx.
export default function PublishCatchAllDefault() {
  return null;
}
