// Parser del markup de color del cliente de RO. Items y skills usan el mismo
// formato BBCode `[color=RRGGBB]texto[/color]`, con otros tags sueltos ([fire],
// [bash], [ctrl]…) que son iconos/refs que aquí eliminamos (dejando el texto
// interior). Un color 000000 = "volver al color por defecto" (en el cliente es
// negro; aquí, sobre fondo oscuro, lo tratamos como el texto normal del tema).
//
// (Las skills usaban antes el formato caret `^RRGGBB`; la DB actualizada las
// trae ya en BBCode, así que ese parser se eliminó.)

export type ColorSegment = { text: string; color: string | null };

function normalizeColor(hex: string): string | null {
  return hex.toLowerCase() === "000000" ? null : `#${hex}`;
}

// --- Items: BBCode `[color=HEX]…[/color]` (+ strip de otros tags) ---
const BBCODE_RE = /\[(\/?)([a-z]+)(?:=([0-9a-fA-F]{6}))?\]/gi;

export function parseBBCode(line: string): ColorSegment[] {
  const segments: ColorSegment[] = [];
  const colorStack: (string | null)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  BBCODE_RE.lastIndex = 0;
  while ((match = BBCODE_RE.exec(line)) !== null) {
    if (match.index > lastIndex) {
      const current = colorStack.length > 0 ? colorStack[colorStack.length - 1] : null;
      segments.push({ text: line.slice(lastIndex, match.index), color: current });
    }
    const [, closing, tag, hex] = match;
    if (tag.toLowerCase() === "color") {
      if (closing) colorStack.pop();
      else colorStack.push(hex ? normalizeColor(hex) : null);
    }
    // Cualquier otro tag ([fire], [bash], [ctrl]…) se descarta (se queda el texto).
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    const current = colorStack.length > 0 ? colorStack[colorStack.length - 1] : null;
    segments.push({ text: line.slice(lastIndex), color: current });
  }
  return segments;
}

export function stripBBCode(text: string): string {
  return text.replace(BBCODE_RE, "");
}
