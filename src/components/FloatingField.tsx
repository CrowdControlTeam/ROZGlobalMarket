import type { ReactNode } from "react";

// Campo con etiqueta flotante estilo "muesca": la etiqueta se apoya sobre el
// borde superior (con fondo del panel para cortarlo) y pasa a color de acento
// al enfocar cualquier control interior. El control va sin borde ni fondo
// propios — usa `floatingControlClass` para heredar el marco.
export const floatingControlClass =
  "w-full bg-transparent text-sm text-ro-text placeholder:text-ro-text-muted focus:outline-none disabled:text-ro-text-muted [color-scheme:dark]";

// Variante para <select> DENTRO de un FloatingField: igual que floatingControlClass
// pero con fondo SÓLIDO del panel (mismo color que el marco, así se ve igual de
// integrado). Un <select> con fondo transparente hace que su popup nativo de
// opciones salga claro en tema oscuro (ilegible); con fondo sólido sale oscuro.
export const floatingSelectClass =
  "w-full bg-ro-panel text-sm text-ro-text focus:outline-none disabled:text-ro-text-muted [color-scheme:dark]";

export function FloatingField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`group relative flex flex-col rounded-lg border border-ro-panel-border bg-ro-panel px-2.5 pb-1.5 pt-2.5 focus-within:border-ro-accent ${className ?? ""}`}
    >
      <span className="pointer-events-none absolute -top-2 left-2 bg-ro-panel px-1 text-[10px] font-medium text-ro-text-muted group-focus-within:text-ro-accent">
        {label}
      </span>
      {children}
    </label>
  );
}
