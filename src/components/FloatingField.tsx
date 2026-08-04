import type { ReactNode } from "react";

// Campo enmarcado con etiqueta pequeña arriba (estilo "label flotante" del
// rediseño): caja compacta con la etiqueta en mayúsculas atenuada y el control
// debajo; borde de acento al enfocar cualquier control interior (focus-within).
// El control (input/select) va sin borde ni fondo propios — usa
// `floatingControlClass` para heredar el marco.
export const floatingControlClass =
  "w-full bg-transparent text-sm text-ro-text placeholder:text-ro-text-muted focus:outline-none disabled:text-ro-text-muted [color-scheme:dark]";

export function FloatingField({
  label,
  children,
  className,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`flex flex-col gap-0.5 rounded-lg border border-ro-panel-border bg-ro-panel-alt px-2.5 py-1 focus-within:border-ro-accent ${className ?? ""}`}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-ro-text-muted">{label}</span>
      {children}
    </label>
  );
}
