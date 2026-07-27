import { MarketPageContent } from "../MarketPageContent";

export default async function MarketTradePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MarketPageContent screenType="TRADE" searchParams={searchParams} />;
}
