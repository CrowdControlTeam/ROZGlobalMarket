import { describe, it, expect } from "vitest";
import { buildCtx, setLevel, poolUsage, isValid, prereqClosure, type Levels } from "./skill-planner";

// Swordman (job 1): Bash = id 5, Magnum Break = id 7 (requiere Bash 5).
const SWORDMAN = 1;
const KNIGHT = 7; // 2nd job, padre Swordman
const BASH = 5;
const MAGNUM = 7;

describe("skill-planner prereqs", () => {
  it("subir una skill arrastra sus prerequisitos", () => {
    const ctx = buildCtx(SWORDMAN);
    const next = setLevel({}, MAGNUM, 1, ctx);
    expect(next).not.toBeNull();
    expect(next![MAGNUM]).toBe(1);
    expect(next![BASH]).toBe(5); // Bash subido a 5 automáticamente
  });

  it("bajar un prerequisito resetea las dependientes", () => {
    const ctx = buildCtx(SWORDMAN);
    const withMagnum = setLevel({}, MAGNUM, 1, ctx)!;
    const lowered = setLevel(withMagnum, BASH, 4, ctx)!;
    expect(lowered[BASH]).toBe(4);
    expect(lowered[MAGNUM]).toBe(0); // Magnum reseteada (necesitaba Bash 5)
  });

  it("subir a un nivel concreto respeta el máximo", () => {
    const ctx = buildCtx(SWORDMAN);
    const next = setLevel({}, BASH, 999, ctx)!;
    expect(next[BASH]).toBe(10); // maxLevel de Bash
  });
});

describe("skill-planner prereqClosure", () => {
  it("incluye la skill y toda su cadena de prereqs (cruzando árboles)", () => {
    const ctx = buildCtx(KNIGHT);
    // Traumatic Blow (398) → Spear Mastery (55), Peco Peco Ride (63);
    // Peco Peco Ride → Endure (8); Endure → Provoke (6).
    const chain = prereqClosure(398, ctx);
    expect(chain).toEqual(new Set([398, 55, 63, 8, 6]));
  });
});

describe("skill-planner pools", () => {
  it("1st job: no deja pasar de 49 puntos", () => {
    const ctx = buildCtx(SWORDMAN);
    expect(ctx.P1).toBe(49);
    expect(ctx.P2).toBe(0);
    // 49 en Bash+... imposible en una sola skill (max 10); uso poolUsage directo.
    const overFirst: Levels = {};
    // llenar 1st con skills editables hasta 50 puntos
    let acc = 0;
    for (const id of ctx.editableIds) {
      if (ctx.bySkill.get(id)!.tier !== "first") continue;
      overFirst[id] = 10;
      acc += 10;
      if (acc >= 50) break;
    }
    expect(isValid(overFirst, ctx)).toBe(false);
  });

  it("2nd job: skills de 1st desbordan al pool de 2nd (69)", () => {
    const ctx = buildCtx(KNIGHT);
    expect(ctx.P1).toBe(49);
    expect(ctx.P2).toBe(69);
    // s1=60 (>49) => overflow 11 al pool 2nd; s2=0 => pool2ndUsed=11 <= 69 válido
    const levels: Levels = {};
    let acc = 0;
    for (const id of ctx.editableIds) {
      if (ctx.bySkill.get(id)!.tier !== "first") continue;
      const add = Math.min(10, 60 - acc);
      levels[id] = add;
      acc += add;
      if (acc >= 60) break;
    }
    const u = poolUsage(levels, ctx);
    expect(u.s1).toBe(60);
    expect(u.pool1stUsed).toBe(49);
    expect(u.pool2ndUsed).toBe(11);
    expect(isValid(levels, ctx)).toBe(true);
  });
});
