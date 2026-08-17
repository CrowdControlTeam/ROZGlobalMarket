import { describe, it, expect } from "vitest";
import {
  buildCtx,
  setLevel,
  poolUsage,
  isValid,
  prereqClosure,
  learnCost,
  encodeBuild,
  decodeBuild,
  type Levels,
} from "./skill-planner";

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

  it("learnCost: sin nada subido, la propia a 1 y cada prereq a su nivel", () => {
    const ctx = buildCtx(KNIGHT);
    // Traumatic Blow→1; Spear Mastery→9; Peco Peco Ride→1; Endure→1; Provoke→5.
    const cost = learnCost(398, ctx, {});
    expect(Object.fromEntries(cost)).toEqual({ 398: 1, 55: 9, 63: 1, 8: 1, 6: 5 });
  });

  it("learnCost: descuenta lo ya subido (0 → sin badge; parcial → diferencia)", () => {
    const ctx = buildCtx(KNIGHT);
    // Provoke ya a 5 (requiere 5) → fuera; Spear Mastery a 3 (requiere 9) → 6.
    const cost = learnCost(398, ctx, { 6: 5, 55: 3 });
    expect(Object.fromEntries(cost)).toEqual({ 398: 1, 55: 6, 63: 1, 8: 1 });
  });
});

describe("skill-planner build codec", () => {
  it("roundtrip: encode → decode devuelve el mismo build", () => {
    const levels: Levels = { 5: 10, 7: 3, 55: 9 }; // Bash 10, Magnum 3, Spear Mastery 9
    const code = encodeBuild(SWORDMAN, levels);
    const decoded = decodeBuild(code);
    expect(decoded).toEqual({ jobId: SWORDMAN, levels });
  });

  it("acota niveles al máximo y descarta skills no editables/inexistentes", () => {
    // Bash a 99 (max 10); 999999 no existe → se descartan/acotan.
    const code = encodeBuild(SWORDMAN, { 5: 99, 999999: 5 });
    const decoded = decodeBuild(code);
    expect(decoded).toEqual({ jobId: SWORDMAN, levels: { 5: 10 } });
  });

  it("código inválido → null", () => {
    expect(decodeBuild("no-es-base64-válido-!!")).toBeNull();
    expect(decodeBuild("")).toBeNull();
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
