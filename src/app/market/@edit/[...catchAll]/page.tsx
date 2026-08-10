import { EditSlot } from "../EditSlot";

// Igual que @detail/@publish: el slot debe resolver en cualquier ruta bajo
// /market (no solo la raíz), así que un catch-all reusa el mismo EditSlot.
export default function EditSlotCatchAll({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <EditSlot searchParams={searchParams} />;
}
