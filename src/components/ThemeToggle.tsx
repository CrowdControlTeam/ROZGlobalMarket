"use client";

import { useState } from "react";
import { Sun, Moon } from "lucide-react";

// Toggle deslizante claro/oscuro para la cabecera. El tema real lo fija el
// servidor en <html data-theme> a partir de la cookie (ver layout.tsx), así
// que aquí solo se recibe el valor inicial ya resuelto (sin parpadeo ni
// desajuste de hidratación) y, al pulsar, se actualiza el atributo del <html>
// y se persiste en la cookie para la siguiente carga.
export function ThemeToggle({ initial }: { initial: "light" | "dark" }) {
  const [theme, setTheme] = useState<"light" | "dark">(initial);
  const dark = theme === "dark";

  function toggle() {
    const next = dark ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `theme=${next};path=/;max-age=31536000;samesite=lax`;
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Cambiar entre tema claro y oscuro"
      onClick={toggle}
      className="relative h-7 w-[3.25rem] flex-none rounded-full border border-white/25 bg-white/15 transition-colors hover:bg-white/25"
    >
      <span
        className={`absolute top-0.5 grid h-6 w-6 place-items-center rounded-full bg-white text-ro-gold-dark shadow transition-transform ${
          dark ? "translate-x-[1.625rem]" : "translate-x-0.5"
        }`}
      >
        {dark ? <Moon size={14} /> : <Sun size={14} />}
      </span>
    </button>
  );
}
