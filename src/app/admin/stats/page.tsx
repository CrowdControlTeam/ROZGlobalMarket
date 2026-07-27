import { getTranslations } from "next-intl/server";
import { ListingType, TradeOfferStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-guard";
import { getMarketStats } from "@/lib/admin-stats";
import { isStatsPeriod, type StatsPeriod } from "@/lib/admin-stats-constants";
import { Panel } from "@/components/Panel";
import { BackLink } from "@/components/BackLink";
import { formatPrice, priceColorClass } from "@/lib/price";
import { listingTypeLabel, offerStatusLabel } from "@/lib/market-labels";
import { AdminStatsPeriodSelect } from "./AdminStatsPeriodSelect";

const LISTING_STATUSES = ["ACTIVE", "SOLD", "CANCELLED", "EXPIRED"] as const;
const TYPES = Object.values(ListingType);
const OFFER_STATUSES = Object.values(TradeOfferStatus);

function RankingTable({
  rows,
  valueLabel,
  rankLabel,
  nameLabel,
  emptyLabel,
  formatValue,
}: {
  rows: { key: string; name: string; value: number }[];
  valueLabel: string;
  rankLabel: string;
  nameLabel: string;
  emptyLabel: string;
  formatValue: (n: number) => React.ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-ro-text-muted">{emptyLabel}</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-ro-panel-border/30 text-left text-ro-text-muted">
          <th className="pb-1 font-normal">{rankLabel}</th>
          <th className="pb-1 font-normal">{nameLabel}</th>
          <th className="pb-1 text-right font-normal">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.key} className="border-b border-ro-panel-border/10">
            <td className="py-1 text-ro-text-muted">{i + 1}</td>
            <td className="py-1">{row.name}</td>
            <td className="py-1 text-right font-semibold">{formatValue(row.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const raw = await searchParams;
  const rawPeriod = Array.isArray(raw.period) ? raw.period[0] : raw.period;
  const period: StatsPeriod = rawPeriod && isStatsPeriod(rawPeriod) ? rawPeriod : "30d";

  const stats = await getMarketStats(period);
  const t = await getTranslations("admin.stats");
  const tMarket = await getTranslations("market");

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/admin" label={t("backToConfig")} />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-heading text-lg text-ro-gold">{t("title")}</h1>
        <AdminStatsPeriodSelect />
      </div>

      <Panel title={t("totals.heading")} className="mb-6">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-ro-text-muted">{t("totals.zenyMoved")}</dt>
            <dd className={`text-lg font-bold ${priceColorClass(stats.totals.zenyMoved)}`}>
              {formatPrice(stats.totals.zenyMoved)}
            </dd>
          </div>
          <div>
            <dt className="text-ro-text-muted">{t("totals.postersCount")}</dt>
            <dd className="text-lg font-bold">{stats.totals.postersCount}</dd>
          </div>
          <div>
            <dt className="text-ro-text-muted">{t("totals.totalUsers")}</dt>
            <dd className="text-lg font-bold">{stats.totals.totalUsers}</dd>
          </div>
          <div>
            <dt className="text-ro-text-muted">{t("totals.giftsSent")}</dt>
            <dd className="text-lg font-bold">{stats.totals.giftsSent}</dd>
          </div>
        </dl>
      </Panel>

      <Panel title={t("listingsByType.heading")} className="mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ro-panel-border/30 text-left text-ro-text-muted">
              <th className="pb-1 font-normal" />
              {LISTING_STATUSES.map((status) => (
                <th key={status} className="pb-1 text-right font-normal">
                  {status === "SOLD" ? t("listingsByType.closed") : tMarket(`listing.status.${status}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TYPES.map((type) => (
              <tr key={type} className="border-b border-ro-panel-border/10">
                <td className="py-1 font-semibold">{listingTypeLabel(tMarket, type)}</td>
                {LISTING_STATUSES.map((status) => (
                  <td key={status} className="py-1 text-right">
                    {stats.totals.listingsByTypeStatus[type][status]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title={t("tradeOffers.heading")} className="mb-6">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          {OFFER_STATUSES.map((status) => (
            <div key={status}>
              <dt className="text-ro-text-muted">{offerStatusLabel(tMarket, status)}</dt>
              <dd className="text-lg font-bold">{stats.totals.tradeOffersByStatus[status]}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title={t("rankings.topPosters")} className="mb-6">
        <RankingTable
          rankLabel={t("rankings.rank")}
          nameLabel={t("rankings.name")}
          emptyLabel={t("rankings.empty")}
          rows={stats.rankings.topPosters.map((r) => ({ key: r.userId, name: r.username, value: r.total }))}
          valueLabel={t("rankings.count")}
          formatValue={(n) => n}
        />
      </Panel>

      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <Panel title={t("rankings.topEarners")}>
          <RankingTable
            rankLabel={t("rankings.rank")}
          nameLabel={t("rankings.name")}
          emptyLabel={t("rankings.empty")}
            rows={stats.rankings.topEarners.map((r) => ({ key: r.userId, name: r.username, value: r.total }))}
            valueLabel="Zeny"
            formatValue={(n) => (
              <span className={priceColorClass(n)}>{formatPrice(n)}</span>
            )}
          />
        </Panel>
        <Panel title={t("rankings.topSpenders")}>
          <RankingTable
            rankLabel={t("rankings.rank")}
          nameLabel={t("rankings.name")}
          emptyLabel={t("rankings.empty")}
            rows={stats.rankings.topSpenders.map((r) => ({ key: r.userId, name: r.username, value: r.total }))}
            valueLabel="Zeny"
            formatValue={(n) => (
              <span className={priceColorClass(n)}>{formatPrice(n)}</span>
            )}
          />
        </Panel>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Panel title={t("rankings.topListedItems")}>
          <RankingTable
            rankLabel={t("rankings.rank")}
          nameLabel={t("rankings.name")}
          emptyLabel={t("rankings.empty")}
            rows={stats.rankings.topListedItems.map((r) => ({ key: r.itemId, name: r.itemName, value: r.total }))}
            valueLabel={t("rankings.count")}
            formatValue={(n) => n}
          />
        </Panel>
        <Panel title={t("rankings.topPurchasedItems")}>
          <RankingTable
            rankLabel={t("rankings.rank")}
          nameLabel={t("rankings.name")}
          emptyLabel={t("rankings.empty")}
            rows={stats.rankings.topPurchasedItems.map((r) => ({ key: r.itemId, name: r.itemName, value: r.total }))}
            valueLabel={t("rankings.quantity")}
            formatValue={(n) => n}
          />
        </Panel>
      </div>
    </main>
  );
}
