// Similitud de texto sin dependencias externas, usada para validar lo que
// devuelve el reconocimiento por captura (src/lib/item-recognition.ts)
// contra el catálogo real en vez de confiar en el texto tal cual.

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let j = 1; j < cols; j++) dist[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(
        dist[i - 1][j] + 1,
        dist[i][j - 1] + 1,
        dist[i - 1][j - 1] + cost,
      );
    }
  }
  return dist[rows - 1][cols - 1];
}

// Ruido de refine/slots que se tolera alrededor del nombre real contenido
// (p.ej. "+15 " o " [4]") antes de dejar de considerarlo "el mismo item
// con prefijo/sufijo" y tratarlo como dos nombres distintos.
const CONTAINMENT_NOISE_THRESHOLD = 6;

// 0..1 (1 = idéntico tras normalizar). Si una cadena contiene a la otra
// entera Y lo que sobra es poco (típico cuando el OCR añade/quita un
// prefijo de refine o un sufijo de slots) se sube a un mínimo de 0.85
// aunque la distancia cruda sea alta. Si lo que sobra es mucho (un nombre
// custom que solo comparte una palabra con un item real corto, p.ej.
// "...Claymore" contiene "Claymore"), NO se sube: sería una coincidencia
// falsa, no ruido de refine/slots.
export function similarity(a: string, b: string): number {
  const s1 = normalize(a);
  const s2 = normalize(b);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const dist = levenshtein(s1, s2);
  const ratio = 1 - dist / Math.max(s1.length, s2.length);

  const shorter = s1.length <= s2.length ? s1 : s2;
  const longer = s1.length <= s2.length ? s2 : s1;
  const extraLength = longer.length - shorter.length;

  if (longer.includes(shorter) && extraLength <= CONTAINMENT_NOISE_THRESHOLD) {
    return Math.max(ratio, 0.85);
  }
  return ratio;
}

// Devuelve el mejor candidato de `candidates` para `query` según `similarity`,
// o null si ninguno alcanza `threshold`.
export function findBestMatch<T>(
  query: string,
  candidates: T[],
  getText: (item: T) => string,
  threshold: number,
): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = similarity(query, getText(candidate));
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return bestScore >= threshold ? best : null;
}
