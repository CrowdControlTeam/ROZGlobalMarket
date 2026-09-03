"use client";

import { useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Share2, MessageSquare } from "lucide-react";
import { ContactModal } from "@/components/UserMention";

type ContactItem = ComponentProps<typeof ContactModal>["item"];

// Botones con icono para la esquina superior derecha de la cabecera del detalle
// (a la altura de la X de cerrar). Mismo estilo que la X del DetailPanel.
const iconBtn =
  "grid h-7 w-7 place-items-center rounded-md text-ro-text-muted transition-colors hover:bg-ro-panel-alt hover:text-ro-text";

// Acciones de utilidad del detalle (Compartir / Contactar). Compartir siempre;
// Contactar solo a la contraparte (no a uno mismo) y con el bot de DMs. Las
// acciones principales (reservar/ofertar; cancelar/editar/republicar) siguen
// como botones en el cuerpo del detalle.
export function ListingActionButtons({
  listingId,
  item,
  poster,
  currentUserId,
  dmAvailable,
}: {
  listingId: string;
  item: ContactItem;
  poster: { id: string; username: string };
  currentUserId: string;
  dmAvailable: boolean;
}) {
  const t = useTranslations("market");
  const [contactOpen, setContactOpen] = useState(false);
  const canContact = dmAvailable && poster.id !== currentUserId;

  function share() {
    const url = `${window.location.origin}/market/${listingId}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={share}
        aria-label={t("card.share")}
        title={t("card.share")}
        className={iconBtn}
      >
        <Share2 size={16} aria-hidden />
      </button>
      {canContact && (
        <>
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            aria-label={t("card.contact")}
            title={t("card.contact")}
            className={iconBtn}
          >
            <MessageSquare size={16} aria-hidden />
          </button>
          <ContactModal
            open={contactOpen}
            onClose={() => setContactOpen(false)}
            recipientId={poster.id}
            recipientUsername={poster.username}
            item={item}
            listingId={listingId}
          />
        </>
      )}
    </div>
  );
}
