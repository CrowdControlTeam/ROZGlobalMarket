"use client";

import { useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Share2, MessageSquare } from "lucide-react";
import { KebabMenu, type KebabItem } from "@/components/KebabMenu";
import { ContactModal } from "@/components/UserMention";

type ContactItem = ComponentProps<typeof ContactModal>["item"];

// Kebab de acciones en la esquina superior derecha del DETALLE del listing:
// mismas acciones de utilidad que el kebab de las tarjetas (Compartir, Contactar)
// menos "Ver detalle" (ya estás aquí) y "Editar" (ya es un botón para el dueño).
// Las acciones principales (reservar/ofertar para la contraparte; cancelar/editar/
// republicar para el dueño) siguen como botones en el cuerpo del detalle.
export function ListingDetailMenu({
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
  // Contactar: al poster (no a uno mismo) y con el bot de DMs disponible.
  const canContact = dmAvailable && poster.id !== currentUserId;

  const items: KebabItem[] = [
    {
      label: t("card.share"),
      icon: <Share2 size={14} aria-hidden />,
      onSelect: () => {
        const url = `${window.location.origin}/market/${listingId}`;
        if (typeof navigator !== "undefined" && navigator.share) {
          navigator.share({ url }).catch(() => {});
        } else {
          navigator.clipboard?.writeText(url);
        }
      },
    },
    ...(canContact
      ? [
          {
            label: t("card.contact"),
            icon: <MessageSquare size={14} aria-hidden />,
            onSelect: () => setContactOpen(true),
          },
        ]
      : []),
  ];

  return (
    <>
      <KebabMenu label={t("card.menu")} items={items} />
      {canContact && (
        <ContactModal
          open={contactOpen}
          onClose={() => setContactOpen(false)}
          recipientId={poster.id}
          recipientUsername={poster.username}
          item={item}
          listingId={listingId}
        />
      )}
    </>
  );
}
