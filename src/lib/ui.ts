// Clases Tailwind compartidas para el "estilo RO": design system propio,
// reutilizado en toda la web.

type ButtonVariant = "primary" | "secondary" | "outline" | "discord" | "danger";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md border-2 px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Acción principal: rojo ROZ (comprar, publicar, enviar).
  primary: "border-ro-red bg-ro-red text-white hover:opacity-90",
  // Acción secundaria: neutro sutil (raised), sin dorado.
  secondary:
    "border-ro-panel-border bg-ro-panel-alt text-ro-text hover:bg-ro-panel-border/30",
  // Sobre superficie de panel: contorno neutro.
  outline:
    "border-ro-panel-border bg-transparent text-ro-text hover:bg-ro-panel-border/40",
  discord:
    "border-[#4752C4] bg-[#5865F2] text-white hover:bg-[#4752C4]",
  danger: "border-red-900 bg-red-800 text-white hover:bg-red-900",
};

export function buttonClass(variant: ButtonVariant = "primary") {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]}`;
}

// Sin ancho, para poder combinarla con un ancho propio (w-28, etc.) sin que
// compita con el w-full de abajo — dos clases de ancho a la vez en el mismo
// elemento dan un resultado impredecible según el orden en la hoja generada.
export const inputBaseClass =
  "rounded-md border-2 border-ro-panel-border bg-ro-panel-alt px-3 py-1.5 text-sm text-ro-text placeholder:text-ro-text-muted focus:border-ro-gold-dark focus:outline-none";

export const inputClass = `w-full ${inputBaseClass}`;

export const selectClass =
  "rounded-md border-2 border-ro-panel-border bg-ro-panel-alt px-2 py-1.5 text-sm text-ro-text focus:border-ro-gold-dark focus:outline-none disabled:opacity-40";

export const labelClass = "mb-1 block text-xs font-medium text-ro-text-muted";
