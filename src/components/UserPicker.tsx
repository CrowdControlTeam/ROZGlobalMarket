"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { searchUsers } from "@/lib/gifts";
import { inputClass } from "@/lib/ui";
import { getErrorMessage } from "@/lib/errors";

export type UserResult = Awaited<ReturnType<typeof searchUsers>>[number];

export function UserPicker({
  onSelect,
  initialQuery,
  selected,
  onClear,
}: {
  onSelect: (user: UserResult) => void;
  initialQuery?: string;
  // Modo controlado (mismo patrón que ItemPicker): con un usuario ya
  // elegido, el input queda bloqueado y el único modo de cambiarlo es el
  // botón de limpiar — evita que se pueda editar el texto libre sin que
  // eso quite la selección del padre. Opcional para no romper el uso
  // existente (NewPublicationForm, sin selected/onClear): ahí sigue
  // comportándose igual que antes.
  selected?: UserResult | null;
  onClear?: () => void;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<UserResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("market.userPicker");
  const tCommon = useTranslations("common");

  const wrapperRef = useRef<HTMLDivElement>(null);
  // El panel de resultados se porta a document.body (ver comentario más
  // abajo) — necesita un nodo real, así que se pospone al montaje en
  // cliente igual que ContactModal en UserMention.tsx.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function handleChange(value: string) {
    setQuery(value);
    setError(null);
    startTransition(async () => {
      try {
        const found = await searchUsers(value);
        setResults(found);
      } catch (err) {
        setError(getErrorMessage(err, tCommon("searchError")));
      }
    });
  }

  function handleClear() {
    onClear?.();
    setQuery("");
    setResults([]);
  }

  const showPanel = !selected && (isPending || !!error || results.length > 0);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={selected ? selected.username : query}
        onChange={(e) => handleChange(e.target.value)}
        readOnly={!!selected}
        placeholder={t("placeholder")}
        className={`${inputClass} ${selected ? "cursor-default pr-8" : ""}`}
      />
      {selected && onClear && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={t("removeSelected")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-ro-text-muted hover:text-ro-gold"
        >
          <X size={16} />
        </button>
      )}

      {/* Portado a document.body en vez de vivir en el flujo normal: este
          componente se usa dentro de la barra de filtros del mercado (flex
          en fila, con más campos al lado) y dentro de un Panel con
          overflow-hidden — en flujo normal, la lista de resultados
          empujaba/descuadraba el resto de la fila; con position:fixed y
          overflow-hidden de por medio, además quedaría recortada. El
          portal + fixed lo saca de ambos problemas de una vez. */}
      {mounted &&
        showPanel &&
        wrapperRef.current &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: wrapperRef.current.getBoundingClientRect().bottom + 4,
              left: wrapperRef.current.getBoundingClientRect().left,
              width: wrapperRef.current.getBoundingClientRect().width,
            }}
            className="z-50 rounded-md border-2 border-ro-panel-border bg-ro-panel-alt shadow-lg"
          >
            {isPending ? (
              <p className="px-2 py-1.5 text-sm text-ro-text-muted">{tCommon("searching")}</p>
            ) : error ? (
              <p className="px-2 py-1.5 text-sm text-red-700">{error}</p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto p-1">
                {results.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(user);
                        setQuery(user.username);
                        setResults([]);
                      }}
                      className="flex w-full items-center gap-2 rounded-md p-2 text-left text-ro-text hover:bg-ro-gold/20"
                    >
                      {user.avatarUrl && (
                        <Image
                          src={user.avatarUrl}
                          alt={user.username}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      )}
                      <span>{user.username}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
