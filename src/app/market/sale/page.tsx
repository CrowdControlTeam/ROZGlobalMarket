import { MarketPageContent } from "../MarketPageContent";

export default async function MarketSalePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MarketPageContent screenType="SALE" searchParams={searchParams} />;
}
