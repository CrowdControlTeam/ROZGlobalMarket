import { MessageSquareText } from "lucide-react";

// Small "this entry has a note" indicator, shared across market cards, the
// publish preview and BiS cards. Callers pass the tooltip label plus any
// layout classes and/or an inline style — cards have very different sizes, so
// each site places the icon where it fits. The icon size is overridable.
export function NoteIndicator({
  label,
  size = 15,
  className = "",
  style,
}: {
  label: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span title={label} aria-label={label} className={`text-ro-text-muted ${className}`} style={style}>
      <MessageSquareText size={size} aria-hidden />
    </span>
  );
}
