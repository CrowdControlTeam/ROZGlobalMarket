import { DetailSlot } from "./DetailSlot";

export default function DetailSlotRoot({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <DetailSlot searchParams={searchParams} />;
}
