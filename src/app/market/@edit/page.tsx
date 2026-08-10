import { EditSlot } from "./EditSlot";

export default function EditSlotRoot({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <EditSlot searchParams={searchParams} />;
}
