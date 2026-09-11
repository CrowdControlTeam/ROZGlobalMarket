// Cálculo de Variable Casting Time (VCT) de Ragnarok Zero. Módulo PURO y
// client-safe (solo depende de @/lib/skill-planner, sin servidor) para poder
// usarse en la calculadora (client component) y en tests (vitest).
//
// Fórmula (multiplicativa por grupos acumulativos):
//   VCT = (BaseVCT − Sum_VCT)
//         × (1 − √[(DEX×2 + INT) ÷ 530])
//         × (1 − Sum_GearVCTReduc ÷ 100)
//         × (1 − Sum_SkillVCTReduc ÷ 100)
// donde:
//   BaseVCT           = cast variable base de una skill (dato del catálogo, en ms).
//   Sum_VCT           = restas PLANAS de cast variable (p. ej. Shield Ring), en s.
//   Sum_GearVCTReduc  = suma de reducciones % de equipo/cartas.
//   Sum_SkillVCTReduc = suma de reducciones % de skills/buffs (y algunos items).

import { buildTrees, getSkill } from "@/lib/skill-planner";

// Denominador de la reducción por stats: con DEX×2 + INT = 530 la reducción por
// stats llega al 100% (cast instantáneo por stats).
const STAT_DIVISOR = 530;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// ¿La skill tiene cast variable? (castVar presente y > 0; array = algún nivel > 0).
export function hasVct(id: number): boolean {
  const cv = getSkill(id)?.stats?.castVar;
  if (cv == null) return false;
  return Array.isArray(cv) ? cv.some((x) => x > 0) : cv > 0;
}

// BaseVCT (en ms) de una skill a un nivel dado. Escalar → ese valor; array →
// castVar[nivel-1] (índice acotado defensivamente); sin castVar → null.
export function baseVctMs(id: number, level: number): number | null {
  const cv = getSkill(id)?.stats?.castVar;
  if (cv == null) return null;
  if (!Array.isArray(cv)) return cv;
  if (cv.length === 0) return null;
  const idx = clamp(Math.trunc(level), 1, cv.length) - 1;
  return cv[idx];
}

// Skills con VCT de un job, para el 2º selector (cascada job → skill). Usa
// buildTrees para reutilizar el manejo del árbol combinado de SuperNovice
// (23 + 4190) y la inclusión del job padre en los 2nd jobs. Dedup por id y
// ordenadas por nombre.
export type VctSkillOption = { id: number; name: string; max: number };
export function jobVctSkills(jobId: number): VctSkillOption[] {
  const seen = new Set<number>();
  const out: VctSkillOption[] = [];
  for (const tree of buildTrees(jobId)) {
    for (const cell of tree.cells) {
      if (seen.has(cell.id)) continue;
      seen.add(cell.id);
      if (!hasVct(cell.id)) continue;
      const s = getSkill(cell.id);
      if (s) out.push({ id: cell.id, name: s.name, max: s.max });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export type VctInput = {
  // Cast variable base en SEGUNDOS, o null si no hay skill elegida (→ solo %).
  baseVctSec: number | null;
  sumFlatSec: number; // Sum_VCT (restas planas, en segundos)
  dex: number;
  int: number;
  gearPct: number; // Σ de las filas de equipo/cartas (%)
  skillPct: number; // Σ de las filas de skills/buffs (%)
};

// Resultado de una sección de reducción: su % de reducción, el % de cast que
// deja pasar, y —si hay skill— el cast (s) aplicando SOLO esa sección al base.
export type SectionResult = {
  reductionPct: number;
  remainingPct: number;
  castSec: number | null;
};

export type VctResult = {
  base: { sumFlatSec: number; reducedBaseSec: number | null };
  stat: SectionResult;
  gear: SectionResult;
  skill: SectionResult;
  total: { reductionPct: number; remainingPct: number; finalCastSec: number | null };
};

// Reducción por stats (0..1): √[(DEX×2 + INT) ÷ 530], acotada a 1 (100%).
export function statReduction(dex: number, int: number): number {
  const v = (Math.max(0, dex) * 2 + Math.max(0, int)) / STAT_DIVISOR;
  return clamp(Math.sqrt(Math.max(0, v)), 0, 1);
}

// Calcula el VCT completo. Cada sección devuelve su propio resultado; el total
// combina las tres reducciones multiplicativas (stats × equipo × skills) sobre
// el base ya restado (BaseVCT − Sum_VCT). Sin skill (baseVctSec null) los
// tiempos absolutos son null y solo tienen sentido los porcentajes.
export function computeVct(input: VctInput): VctResult {
  const factorStat = 1 - statReduction(input.dex, input.int);
  const factorGear = 1 - clamp(input.gearPct, 0, 100) / 100;
  const factorSkill = 1 - clamp(input.skillPct, 0, 100) / 100;

  const reducedBaseSec =
    input.baseVctSec == null ? null : Math.max(0, input.baseVctSec - input.sumFlatSec);

  const section = (factor: number): SectionResult => ({
    reductionPct: (1 - factor) * 100,
    remainingPct: factor * 100,
    castSec: reducedBaseSec == null ? null : reducedBaseSec * factor,
  });

  const product = factorStat * factorGear * factorSkill;

  return {
    base: { sumFlatSec: input.sumFlatSec, reducedBaseSec },
    stat: section(factorStat),
    gear: section(factorGear),
    skill: section(factorSkill),
    total: {
      reductionPct: (1 - product) * 100,
      remainingPct: product * 100,
      finalCastSec: reducedBaseSec == null ? null : reducedBaseSec * product,
    },
  };
}
