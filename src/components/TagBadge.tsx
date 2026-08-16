// Chip de etiqueta de BiS: rol (acento) o job (apagado). Compartido entre las
// cards de BiS y las previews (click derecho), para que el estilo sea el mismo.
export type TagVariant = "role" | "job";

export function TagBadge({ label, variant }: { label: string; variant: TagVariant }) {
  return (
    <span
      className={`rounded px-1 py-px text-[0.6rem] ${
        variant === "role"
          ? "bg-ro-accent/10 text-ro-accent"
          : "bg-ro-panel-border/50 text-ro-text-muted"
      }`}
    >
      {label}
    </span>
  );
}
