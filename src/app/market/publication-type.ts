// Tipo de publicación del mercado, compartido por el flujo de publicar (modal
// PublishForm/PublishModal) y su slot interceptor (@publish/PublishSlot). Vive
// suelto —no dentro de un componente— porque lo consumen varios.
export type PublicationType = "SALE" | "BUY" | "TRADE" | "GIFT";

export const PUBLICATION_TYPES: PublicationType[] = ["SALE", "BUY", "TRADE", "GIFT"];

export function isPublicationType(value: string | undefined): value is PublicationType {
  return PUBLICATION_TYPES.includes(value as PublicationType);
}
