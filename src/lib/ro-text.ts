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

// Versión aclarada de un color para TEMA OSCURO. Los códigos del cliente están
// pensados para el fondo claro de la ventana del juego; en oscuro los tonos
// oscuros (azules, verdes, rojos, gris apagado) pierden contraste. Si el color
// ya es suficientemente luminoso se devuelve igual; si no, se sube la
// luminosidad (HSL) preservando el tono, para que el significado del color se
// mantenga. Lo elige el CSS por tema (ver .ro-desc-color en globals.css).
export function darkModeColor(color: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(color);
  if (!m) return color;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  if (luminance >= 0.25) return color; // ya legible sobre fondo oscuro
  const [h, s, l] = rgbToHsl(r, g, b);
  const nl = Math.max(l, 0.62);
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(nl * 100)}%)`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return [h * 60, s, l];
}
