import { RepostSlot } from "../RepostSlot";

// Igual que @detail/@publish/@edit: el slot debe resolver en cualquier ruta bajo
// /market (no solo la raíz), así que un catch-all reusa el mismo RepostSlot.
export default function RepostSlotCatchAll({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <RepostSlot searchParams={searchParams} />;
}
