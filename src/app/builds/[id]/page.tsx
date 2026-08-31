import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Pencil, PersonStanding } from "lucide-react";
import { requireSession } from "@/lib/guard";
import { getBuild } from "@/lib/builds";
import { getJob } from "@/lib/skill-planner";
import type { BuildSlot } from "@/db/enums";
import { parsePositions, POSITION_TO_SLOT } from "@/lib/build-constants";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { ItemIcon } from "@/components/ItemIcon";
import { BackLink } from "@/components/BackLink";
import { buttonClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Paperdoll estilo ventana de equipo del juego: dos columnas de 5 slots
// flanqueando al personaje en el centro.
const LEFT_SLOTS: readonly BuildSlot[] = ["HEADGEAR_TOP", "HEADGEAR_MID", "HEADGEAR_LOW", "ARMOR", "WEAPON"];
const RIGHT_SLOTS: readonly BuildSlot[] = ["SHIELD", "GARMENT", "FOOTGEAR", "ACCESSORY_LEFT", "ACCESSORY_RIGHT"];

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

  // Ocupación de tocados: un tocado multi-slot (p. ej. "Middle, Lower") se
  // muestra en TODAS sus celdas. `primary` marca la celda donde se guarda (ahí
  // van las options/cartas; en las demás solo el item).
  type Entry = (typeof buildRow.entries)[number];
  const headAt = new Map<BuildSlot, { e: Entry; primary: boolean }>();
  for (const e of buildRow.entries) {
    for (const p of parsePositions(e.item.position)) {
      const s = POSITION_TO_SLOT[p];
      headAt.set(s, { e, primary: s === e.slot });
    }
  }

  // Celda de un slot del paperdoll: icono + nombre (con refino) + chips de
  // options/cartas. Vacía = marco punteado. `mirror` invierte el layout para la
  // columna derecha (icono a la derecha, texto alineado a la derecha).
  const cell = (slot: BuildSlot, mirror: boolean) => {
    const head = headAt.get(slot);
    const e = head ? head.e : bySlot.get(slot);
    // En una celda secundaria de un tocado multi-slot, las options/cartas se
    // muestran solo en su celda principal.
    const showExtras = head ? head.primary : true;
    return (
      <div
        className={`flex min-h-[3.5rem] items-center gap-2 rounded-lg border border-ro-panel-border p-2 ${
          e ? "bg-ro-panel-alt" : "bg-ro-panel-alt/40"
        } ${mirror ? "flex-row-reverse text-right" : ""}`}
      >
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border ${
            e ? "border-ro-panel-border bg-ro-panel" : "border-dashed border-ro-panel-border/60"
          }`}
        >
          {e && <ItemIcon item={e.item} width={28} height={28} refine={e.refineLevel} alt="" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-ro-text-muted">{tSlot(slot)}</p>
          {e ? (
            <>
              <p className="truncate text-sm text-ro-text">
                {formatItemDisplayName(e.item.name, e.refineLevel, e.item.slotCount)}
              </p>
              {showExtras && (e.options.length > 0 || e.cards.length > 0) && (
                <div className={`mt-1 flex flex-wrap items-center gap-1 ${mirror ? "justify-end" : ""}`}>
                  {e.options.map((o) => (
                    <span key={o.id} className="rounded border border-ro-accent/30 bg-ro-accent/10 px-1 py-0.5 text-[0.65rem] text-ro-accent">
                      {o.def.label} {o.value}
                    </span>
                  ))}
                  {e.cards.map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-0.5 rounded border border-ro-panel-border bg-ro-panel px-1 py-0.5 text-[0.65rem] text-ro-text-muted">
                      <ItemIcon item={c.card} width={14} height={14} alt="" />
                      {c.card.name}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-ro-text-muted/50">—</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
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

      {/* Paperdoll: columna izquierda · personaje · columna derecha. En móvil se
          apila (personaje arriba y las dos columnas debajo). */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="order-2 flex flex-1 flex-col gap-2 sm:order-1">
          {LEFT_SLOTS.map((slot) => (
            <div key={slot}>{cell(slot, false)}</div>
          ))}
        </div>
        <div className="order-1 flex shrink-0 items-center justify-center sm:order-2 sm:w-36">
          <div className="flex w-full flex-col items-center gap-2 rounded-xl border border-ro-panel-border bg-ro-panel-alt p-4 text-center">
            <PersonStanding size={48} className="text-ro-text-muted" aria-hidden />
            <span className="text-sm font-semibold text-ro-text">{jobName}</span>
          </div>
        </div>
        <div className="order-3 flex flex-1 flex-col gap-2">
          {RIGHT_SLOTS.map((slot) => (
            <div key={slot}>{cell(slot, true)}</div>
          ))}
        </div>
      </div>
    </main>
  );
}
