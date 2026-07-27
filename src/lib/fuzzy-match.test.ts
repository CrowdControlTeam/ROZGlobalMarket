import { describe, it, expect } from "vitest";
import { similarity, findBestMatch } from "@/lib/fuzzy-match";

describe("similarity", () => {
  it("es 1 para cadenas idénticas", () => {
    expect(similarity("Silk Robe", "Silk Robe")).toBe(1);
  });

  it("es 0 si alguna queda vacía tras normalizar", () => {
    expect(similarity("", "Silk Robe")).toBe(0);
    expect(similarity("+++", "Silk Robe")).toBe(0);
  });

  it("ignora acentos, mayúsculas y puntuación al normalizar", () => {
    expect(similarity("Ángel", "angel")).toBe(1);
    expect(similarity("Silk-Robe", "silk robe")).toBe(1);
  });

  it("sube a >= 0.85 cuando una contiene a la otra con poco ruido (refine/slots)", () => {
    // "+15 Silk Robe" contiene "Silk Robe" con solo el prefijo de refine.
    expect(similarity("+15 Silk Robe", "Silk Robe")).toBeGreaterThanOrEqual(0.85);
    expect(similarity("Silk Robe[1]", "Silk Robe")).toBeGreaterThanOrEqual(0.85);
  });

  it("NO sube el score si el ruido de contención es grande (coincidencia falsa)", () => {
    // Un nombre largo que solo comparte una palabra corta con el item real.
    expect(similarity("Excalibur Claymore Longsword", "Claymore")).toBeLessThan(0.85);
  });
});

describe("findBestMatch", () => {
  const candidates = [{ name: "Silk Robe" }, { name: "Cotton Shirt" }, { name: "Full Plate" }];

  it("devuelve el mejor candidato por encima del umbral", () => {
    expect(findBestMatch("Silk Robe", candidates, (c) => c.name, 0.5)).toEqual({ name: "Silk Robe" });
    // Con ruido de refine sigue emparejando el correcto.
    expect(findBestMatch("+7 Silk Robe", candidates, (c) => c.name, 0.5)).toEqual({ name: "Silk Robe" });
  });

  it("devuelve null si ninguno alcanza el umbral", () => {
    expect(findBestMatch("Zzz Inexistente", candidates, (c) => c.name, 0.5)).toBeNull();
  });

  it("devuelve null con lista de candidatos vacía", () => {
    expect(findBestMatch("Silk Robe", [], (c: { name: string }) => c.name, 0.5)).toBeNull();
  });
});
