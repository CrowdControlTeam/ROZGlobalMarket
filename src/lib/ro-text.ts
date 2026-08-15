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
// Luminancia objetivo (WCAG relativa) para el texto sobre el panel oscuro
// (~0.008 de luminancia): 0.3 da un contraste cómodo (~6:1). Se sube la
// luminosidad HSL hasta alcanzarla, así el azul/púrpura (percibidos más oscuros)
// se aclaran más que el verde/rojo a igual luminosidad.
const DARK_TARGET_LUMINANCE = 0.3;

export function darkModeColor(color: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(color);
  if (!m) return color;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  if (relLuminance(r, g, b) >= DARK_TARGET_LUMINANCE) return color; // ya legible
  const [h, s] = rgbToHsl(r, g, b);
  let l = rgbToHsl(r, g, b)[2];
  // Sube la luminosidad (mismo tono/saturación) hasta llegar a la luminancia
  // objetivo, o hasta casi blanco como tope.
  for (let candidate = l; candidate <= 0.94; candidate += 0.02) {
    l = candidate;
    const [rr, gg, bb] = hslToRgb(h, s, candidate);
    if (relLuminance(rr, gg, bb) >= DARK_TARGET_LUMINANCE) break;
  }
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

function relLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
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

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}
