import { parseBBCode, parseCaretColor } from "@/lib/ro-text";

// Renderiza un bloque de descripción del cliente de RO respetando los colores.
// `format`: "bbcode" para items ([color=HEX]…[/color]), "caret" para skills
// (^RRGGBB). Un color por defecto (000000) usa el texto normal del tema.
export function RoDescription({
  lines,
  format = "bbcode",
  className,
}: {
  lines: string[];
  format?: "bbcode" | "caret";
  className?: string;
}) {
  const parse = format === "caret" ? parseCaretColor : parseBBCode;
  return (
    <div className={`whitespace-pre-wrap text-sm leading-snug text-ro-text ${className ?? ""}`}>
      {lines.map((line, i) => (
        <div key={i} className="min-h-[1.25em]">
          {parse(line).map((seg, j) => (
            <span key={j} style={seg.color ? { color: seg.color } : undefined}>
              {seg.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
