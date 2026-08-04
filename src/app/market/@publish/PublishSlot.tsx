import { isImageRecognitionAvailable } from "@/lib/item-recognition";
import { PublishModal } from "../PublishModal";
import type { PublicationType } from "../new/NewPublicationForm";

const VALID_TYPES: PublicationType[] = ["SALE", "BUY", "TRADE", "GIFT"];

// Slot @publish: modal de "Publicar" interceptado sobre el mercado, activado
// por el query param ?publish=<tipo> (mismo patrón que @detail/?listing, para
// no depender del segmento de ruta). El mercado queda montado detrás; el acceso
// directo /market/new sigue siendo la página completa de respaldo.
export async function PublishSlot({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const value = Array.isArray(raw.publish) ? raw.publish[0] : raw.publish;
  if (!value) return null;

  const recognitionEnabled = await isImageRecognitionAvailable();
  const initialType = VALID_TYPES.includes(value as PublicationType) ? (value as PublicationType) : "SALE";

  return <PublishModal recognitionEnabled={recognitionEnabled} initialType={initialType} />;
}
