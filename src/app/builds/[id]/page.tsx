import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireSession } from "@/lib/guard";
import { getBuild } from "@/lib/builds";
import { getJob } from "@/lib/skill-planner";
import { BUILD_SLOTS } from "@/lib/build-constants";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { ItemIcon } from "@/components/ItemIcon";
import { BackLink } from "@/components/BackLink";
import { buttonClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function BuildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const t = await getTranslations("builds");
  const tSlot = await getTranslations("builds.slots");
  const tTag = await getTranslations("builds.tags");
  const buildRow = await getBuild(id);
  if (!buildRow) notFound();

  const isOwner = buildRow.owner.id === session.user.discordId;
  const jobName = getJob(buildRow.jobId)?.name ?? "—";
  const bySlot = new Map(buildRow.entries.map((e) => [e.slot, e]));
  const filledSlots = BUILD_SLOTS.filter((s) => bySlot.has(s));

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <BackLink href="/builds" label={t("form.back")} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold text-ro-text">{buildRow.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ro-text-muted">
            <span className="font-semibold text-ro-text">{jobName}</span>
            <span>· {isOwner ? t("list.you") : buildRow.owner.username}</span>
            {buildRow.tags.map((tag) => (
              <span key={tag} className="rounded border border-ro-accent/30 bg-ro-accent/10 px-1.5 py-0.5 text-xs text-ro-accent">
                {tTag(tag)}
              </span>
            ))}
          </p>
        </div>
        {isOwner && (
          <Link href={`/builds/${id}/edit`} className={`shrink-0 ${buttonClass("outline")}`}>
            <Pencil size={15} aria-hidden />
            {t("list.edit")}
          </Link>
        )}
      </div>

      {buildRow.notes && (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ro-text">{buildRow.notes}</p>
      )}

      <ul className="mt-5 flex flex-col gap-2">
        {filledSlots.length === 0 ? (
          <p className="text-sm text-ro-text-muted">{t("detail.noPieces")}</p>
        ) : (
          filledSlots.map((slot) => {
            const e = bySlot.get(slot)!;
            return (
              <li key={slot} className="flex items-center gap-3 rounded-lg border border-ro-panel-border bg-ro-panel-alt p-2">
                <span className="w-28 shrink-0 text-xs font-semibold text-ro-text-muted">{tSlot(slot)}</span>
                <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border border-ro-panel-border bg-ro-panel">
                  <ItemIcon item={e.item} width={28} height={28} refine={e.refineLevel} alt="" />
                </div>
                <p className="min-w-0 flex-1 truncate text-sm text-ro-text">
                  {formatItemDisplayName(e.item.name, e.refineLevel, e.item.slotCount)}
                </p>
              </li>
            );
          })
        )}
      </ul>
    </main>
  );
}
