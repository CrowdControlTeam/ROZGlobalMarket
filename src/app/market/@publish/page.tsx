import { PublishSlot } from "./PublishSlot";

export default function PublishSlotRoot({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PublishSlot searchParams={searchParams} />;
}
