import { parseBBCode } from "@/lib/ro-text";

// Renderiza un bloque de descripción del cliente de RO respetando los colores.
// Items y skills usan el mismo markup BBCode ([color=HEX]…[/color]). Un color
// por defecto (000000) usa el texto normal del tema.
export function RoDescription({
  lines,
  className,
}: {
  lines: string[];
  className?: string;
}) {
  return (
    <div className={`whitespace-pre-wrap text-sm leading-snug text-ro-text ${className ?? ""}`}>
      {lines.map((line, i) => (
        <div key={i} className="min-h-[1.25em]">
          {parseBBCode(line).map((seg, j) => (
            <span key={j} style={seg.color ? { color: seg.color } : undefined}>
              {seg.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
