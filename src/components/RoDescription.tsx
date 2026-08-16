import { parseBBCode, darkModeColor } from "@/lib/ro-text";

// Renderiza un bloque de descripción del cliente de RO respetando los colores.
// Items y skills usan el mismo markup BBCode ([color=HEX]…[/color]). Un color
// por defecto (000000) usa el texto normal del tema. Cada segmento con color
// lleva su versión clara (--c-l, la del juego) y una aclarada para oscuro
// (--c-d); el CSS elige según el tema (ver .ro-desc-color en globals.css).
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
          {parseBBCode(line).map((seg, j) =>
            seg.color ? (
              <span
                key={j}
                className="ro-desc-color"
                style={{ "--c-l": seg.color, "--c-d": darkModeColor(seg.color) } as React.CSSProperties}
              >
                {seg.text}
              </span>
            ) : (
              <span key={j}>{seg.text}</span>
            ),
          )}
        </div>
      ))}
    </div>
  );
}
