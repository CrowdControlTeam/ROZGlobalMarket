"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { sendContactMessage } from "@/lib/contact-messages";
import { Sidebar } from "./Sidebar";
import { buttonClass, inputBaseClass, labelClass } from "@/lib/ui";
import { getErrorMessage } from "@/lib/errors";

type MentionItem = { id: string; name: string; iconUrl: string };

// Atribución de usuario en tarjetas/detalle de objetos: "ti" si eres tú, si
// no "@NombreVisible" (formato de mención de Discord). Cuando el bot de DMs
// está disponible (dmAvailable, ver isDmFeatureAvailable en discord-bot.ts)
// y se pasa el item sobre el que se está mencionando a esa persona, el
// nombre se vuelve clicable y abre un panel para escribirle por Discord con
// el contexto del item — así no hace falta ir a buscar el perfil aparte.
export function UserMention({
  userId,
  username,
  viewerId,
  capitalize = false,
  item,
  listingId,
  dmAvailable = false,
}: {
  userId: string;
  username: string;
  viewerId: string;
  capitalize?: boolean;
  item?: MentionItem;
  // Listing desde la que se menciona a esta persona (si la hay) — permite
  // que el DM de contacto enlace de vuelta al listing. No todas las
  // menciones tienen una (p.ej. en Regalos no hay listing que enlazar).
  listingId?: string;
  dmAvailable?: boolean;
}) {
  const t = useTranslations("common");
  const isSelf = userId === viewerId;
  const label = isSelf ? (capitalize ? t("you") : t("yourself")) : `@${username}`;
  const clickable = dmAvailable && !isSelf && !!item;
  const [open, setOpen] = useState(false);

  if (!clickable) return <>{label}</>;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // UserMention puede vivir dentro del <Link> que envuelve toda la
          // tarjeta en MarketResults.tsx — sin esto, el click abre el modal
          // Y ADEMÁS navega a la página de detalle por el bubbling al <Link>.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="underline decoration-dotted underline-offset-2 hover:text-ro-gold"
      >
        {label}
      </button>
      <ContactModal
        open={open}
        onClose={() => setOpen(false)}
        recipientId={userId}
        recipientUsername={username}
        item={item}
        listingId={listingId}
      />
    </>
  );
}

function ContactModal({
  open,
  onClose,
  recipientId,
  recipientUsername,
  item,
  listingId,
}: {
  open: boolean;
  onClose: () => void;
  recipientId: string;
  recipientUsername: string;
  item: MentionItem;
  listingId?: string;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const submittingRef = useRef(false);
  const t = useTranslations("market.contact");
  const tField = useTranslations("market.field");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("market.status");

  function handleClose() {
    onClose();
    setMessage("");
    setError(null);
    setSent(false);
    submittingRef.current = false;
  }

  // document no existe en el render de servidor — createPortal necesita un
  // nodo real. Comprobar `typeof window` directamente en el render rompía
  // la hidratación: la primera pasada en cliente YA ve window definido, así
  // que montaba el portal de golpe mientras el servidor había devuelto null
  // (justo el "server/client branch" que advierte el error de Next.js). Se
  // pospone a un useEffect para que la pasada de hidratación coincida en
  // ambos lados, y el portal se cree recién en el render posterior.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // Portal a document.body: UserMention aparece dentro de texto en línea
  // (<p>, <dd>) e incluso dentro del <Link> que envuelve toda la tarjeta en
  // MarketResults.tsx — el overlay de pantalla completa de Sidebar (con su
  // <form>/<h2>/<div>) no puede vivir ahí sin romper el HTML (un <p> no
  // puede contener un <div>). El propio portal resuelve el problema del HTML,
  // pero React sigue burbujeando los eventos por el árbol de React (no el
  // del DOM) — sin este stopPropagation, un click aquí dentro seguiría
  // llegando al <Link> ancestro y navegando a la tarjeta por debajo.
  return createPortal(
    <div onClick={(e) => e.stopPropagation()}>
    <Sidebar side="right" open={open} onClose={handleClose} title={t("writeTo", { username: recipientUsername })}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-md border-2 border-ro-panel-border/30 p-2">
          <Image src={item.iconUrl} alt={item.name} width={32} height={32} />
          <span className="text-sm">{item.name}</span>
        </div>
        {sent ? (
          <p className="text-sm text-green-700">{t("sent")}</p>
        ) : (
          <form
            action={(formData) => {
              if (submittingRef.current) return;
              submittingRef.current = true;
              setError(null);
              startTransition(async () => {
                try {
                  await sendContactMessage(formData);
                  setSent(true);
                } catch (err) {
                  submittingRef.current = false;
                  setError(getErrorMessage(err));
                }
              });
            }}
            className="flex flex-col gap-2"
          >
            <input type="hidden" name="recipientId" value={recipientId} />
            <input type="hidden" name="itemId" value={item.id} />
            {listingId && <input type="hidden" name="listingId" value={listingId} />}
            <label className={labelClass}>{tField("message")}</label>
            <textarea
              name="message"
              rows={4}
              required
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={inputBaseClass}
            />
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={isPending} className={buttonClass("primary")}>
              {isPending ? tStatus("sending") : tCommon("send")}
            </button>
          </form>
        )}
      </div>
    </Sidebar>
    </div>,
    document.body
  );
}
