import { describe, it, expect } from "vitest";
import { baseVctMs, computeVct, hasVct, statReduction } from "@/lib/vct";

describe("statReduction", () => {
  it("es 0 sin stats y crece con DEX/INT", () => {
    expect(statReduction(0, 0)).toBe(0);
    // (DEX×2 + INT)/530 = (100×2 + 30)/530 = 230/530 → √
    expect(statReduction(100, 30)).toBeCloseTo(Math.sqrt(230 / 530), 10);
  });
  it("satura a 1 (100%) cuando DEX×2 + INT ≥ 530", () => {
    expect(statReduction(265, 0)).toBe(1); // 530/530
    expect(statReduction(400, 200)).toBe(1); // > 530
  });
});

describe("computeVct — con skill (tiempo absoluto)", () => {
  it("aplica la fórmula completa", () => {
    // Base 5s, sin resta plana, DEX 100/INT 30, 20% equipo, 30% skills.
    const r = computeVct({ baseVctSec: 5, sumFlatSec: 0, dex: 100, int: 30, gearPct: 20, skillPct: 30 });
    const fStat = 1 - Math.sqrt(230 / 530);
    const expected = 5 * fStat * 0.8 * 0.7;
    expect(r.base.reducedBaseSec).toBe(5);
    expect(r.total.finalCastSec).toBeCloseTo(expected, 10);
    // Cada sección expone su propio cast (solo esa reducción sobre el base).
    expect(r.stat.castSec).toBeCloseTo(5 * fStat, 10);
    expect(r.gear.castSec).toBeCloseTo(5 * 0.8, 10);
    expect(r.skill.castSec).toBeCloseTo(5 * 0.7, 10);
  });

  it("resta el Sum_VCT plano antes de las reducciones y nunca baja de 0", () => {
    const r = computeVct({ baseVctSec: 2, sumFlatSec: 0.5, dex: 0, int: 0, gearPct: 0, skillPct: 0 });
    expect(r.base.reducedBaseSec).toBe(1.5);
    expect(r.total.finalCastSec).toBe(1.5); // sin reducciones %
    const clamped = computeVct({ baseVctSec: 1, sumFlatSec: 3, dex: 0, int: 0, gearPct: 0, skillPct: 0 });
    expect(clamped.base.reducedBaseSec).toBe(0);
    expect(clamped.total.finalCastSec).toBe(0);
  });
});

describe("computeVct — sin skill (solo %)", () => {
  it("deja los tiempos absolutos en null y calcula los porcentajes", () => {
    const r = computeVct({ baseVctSec: null, sumFlatSec: 1, dex: 100, int: 30, gearPct: 20, skillPct: 30 });
    expect(r.base.reducedBaseSec).toBeNull();
    expect(r.total.finalCastSec).toBeNull();
    expect(r.stat.castSec).toBeNull();
    const product = (1 - Math.sqrt(230 / 530)) * 0.8 * 0.7;
    expect(r.total.remainingPct).toBeCloseTo(product * 100, 10);
    expect(r.total.reductionPct).toBeCloseTo((1 - product) * 100, 10);
  });
});

describe("computeVct — clamps de %", () => {
  it("acota gearPct/skillPct a [0,100]", () => {
    const r = computeVct({ baseVctSec: 5, sumFlatSec: 0, dex: 0, int: 0, gearPct: 150, skillPct: -10 });
    expect(r.gear.remainingPct).toBe(0); // 150% → factor 0
    expect(r.skill.remainingPct).toBe(100); // −10% → factor 1
    expect(r.total.finalCastSec).toBe(0); // el equipo lo deja en 0
  });
});

describe("baseVctMs / hasVct — escalar vs array por nivel", () => {
  it("Soul Strike (id 13) es escalar: mismo valor en todos los niveles", () => {
    expect(hasVct(13)).toBe(true);
    expect(baseVctMs(13, 1)).toBe(400);
    expect(baseVctMs(13, 10)).toBe(400);
  });
  it("Cold Bolt (id 14) es array y sube por nivel", () => {
    expect(hasVct(14)).toBe(true);
    expect(baseVctMs(14, 1)).toBe(500);
    expect(baseVctMs(14, 10)).toBe(3200);
  });
  it("Safety Wall (id 12) es array y baja por nivel", () => {
    expect(baseVctMs(12, 1)).toBe(3200);
    expect(baseVctMs(12, 10)).toBe(320);
  });
  it("acota el nivel fuera de rango al primero/último", () => {
    expect(baseVctMs(14, 0)).toBe(500); // < 1 → nivel 1
    expect(baseVctMs(14, 99)).toBe(3200); // > max → último
  });
  it("devuelve null para una skill sin cast variable", () => {
    // id 2 (Bash) es Weapon sin castVar en el catálogo.
    expect(hasVct(2)).toBe(false);
    expect(baseVctMs(2, 1)).toBeNull();
  });
});
