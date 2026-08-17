import { RepostSlot } from "./RepostSlot";

export default function RepostSlotRoot({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <RepostSlot searchParams={searchParams} />;
}
