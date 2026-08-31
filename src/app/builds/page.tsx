import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { requireSession } from "@/lib/guard";
import { listBuilds, myBuildCount } from "@/lib/builds";
import { loadMarketConfig } from "@/lib/market-config";
import { getJob } from "@/lib/skill-planner";
import { ItemIcon } from "@/components/ItemIcon";
import { buttonClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function BuildsPage() {
  const session = await requireSession();
  const me = session.user.discordId;
  const t = await getTranslations("builds");
  const tTag = await getTranslations("builds.tags");
  const [builds, { maxBuildsPerUser }, myCount] = await Promise.all([
    listBuilds(),
    loadMarketConfig(),
    myBuildCount(),
  ]);
  const atLimit = myCount >= maxBuildsPerUser;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ro-text">{t("title")}</h1>
          <p className="mt-1 text-sm text-ro-text-muted">
            {t("list.myLimit", { n: myCount, max: maxBuildsPerUser })}
          </p>
        </div>
        {!atLimit && (
          <Link href="/builds/new" className={`shrink-0 ${buttonClass("primary")}`}>
            <Plus size={16} aria-hidden />
            {t("list.create")}
          </Link>
        )}
      </div>

      {builds.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ro-panel-border bg-ro-panel-alt px-6 py-10 text-center text-ro-text-muted">
          {t("list.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {builds.map((b) => (
            <li key={b.id}>
              <Link
                href={`/builds/${b.id}`}
                className="flex items-center gap-3 rounded-xl border border-ro-panel-border bg-ro-panel p-3 transition-colors hover:border-ro-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ro-text">{b.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ro-text-muted">
                    <span className="font-semibold text-ro-text">{getJob(b.jobId)?.name ?? "—"}</span>
                    <span>· {b.owner.id === me ? t("list.you") : b.owner.username}</span>
                    {b.tags.map((tag) => (
                      <span key={tag} className="rounded border border-ro-accent/30 bg-ro-accent/10 px-1 py-0.5 text-[0.65rem] text-ro-accent">
                        {tTag(tag)}
                      </span>
                    ))}
                  </p>
                </div>
                {/* Iconos de las piezas (hasta 10) como vista rápida de la build. */}
                <div className="flex shrink-0 -space-x-1">
                  {b.entries.slice(0, 10).map((e) => (
                    <div key={e.id} className="grid h-7 w-7 place-items-center overflow-hidden rounded border border-ro-panel-border bg-ro-panel-alt">
                      <ItemIcon item={e.item} width={22} height={22} alt="" />
                    </div>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
