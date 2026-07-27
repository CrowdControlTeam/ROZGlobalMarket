import { DetailPanel } from "../DetailPanel";
import { ListingDetailContent } from "../ListingDetailContent";

// Contenido del slot @detail, compartido entre page.tsx (raíz /market) y
// [...catchAll]/page.tsx (cualquier otra ruta bajo /market): en vez de
// depender del segmento de ruta (lo que llevó al bug de Intercepting
// Routes con (.)[id]), el panel se abre/cierra según el query param
// ?listing=<id>, así funciona igual sin importar en qué pantalla del
// mercado esté el usuario, y /market queda montado detrás.
export async function DetailSlot({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const id = Array.isArray(raw.listing) ? raw.listing[0] : raw.listing;
  if (!id) return null;

  return (
    <DetailPanel>
      <ListingDetailContent id={id} />
    </DetailPanel>
  );
}
