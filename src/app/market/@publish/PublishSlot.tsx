import { isImageRecognitionAvailable } from "@/lib/item-recognition";
import { PublishModal } from "../PublishModal";
import { isPublicationType } from "../publication-type";

// Slot @publish: modal de "Publicar" interceptado sobre el mercado, activado
// por el query param ?publish=<tipo> (mismo patrón que @detail/?listing, para
// no depender del segmento de ruta). El mercado queda montado detrás. Es la
// única vía de publicar: no hay página /market/new independiente.
export async function PublishSlot({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const value = Array.isArray(raw.publish) ? raw.publish[0] : raw.publish;
  if (!value) return null;

  const recognitionEnabled = await isImageRecognitionAvailable();
  const initialType = isPublicationType(value) ? value : "SALE";

  return <PublishModal recognitionEnabled={recognitionEnabled} initialType={initialType} />;
}
