import { PublishSlot } from "../PublishSlot";

// Igual que @detail: el slot debe resolver en cualquier ruta bajo /market (no
// solo la raíz), así que un catch-all reusa el mismo PublishSlot.
export default function PublishSlotCatchAll({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PublishSlot searchParams={searchParams} />;
}
