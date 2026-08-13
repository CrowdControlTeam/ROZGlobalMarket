import { MessageSquareText } from "lucide-react";

// Small "this entry has a note" indicator, shared across market cards, the
// publish preview and BiS cards. Callers pass the tooltip label plus any
// layout classes (positioning, sizing box); the icon size is overridable.
export function NoteIndicator({
  label,
  size = 15,
  className = "",
}: {
  label: string;
  size?: number;
  className?: string;
}) {
  return (
    <span title={label} aria-label={label} className={`text-ro-text-muted ${className}`}>
      <MessageSquareText size={size} aria-hidden />
    </span>
  );
}
