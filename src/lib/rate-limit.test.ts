import { describe, it, expect } from "vitest";
import { decideRateLimit } from "@/lib/rate-limit";

const LIMIT = 20;
const WINDOW = 60_000;

describe("decideRateLimit", () => {
  it("arranca ventana nueva si no hay registro previo", () => {
    expect(decideRateLimit(null, 1_000, LIMIT, WINDOW)).toEqual({ kind: "reset" });
  });

  it("arranca ventana nueva si la anterior ya expiró", () => {
    const existing = { count: 20, windowStartMs: 0 };
    expect(decideRateLimit(existing, WINDOW, LIMIT, WINDOW)).toEqual({ kind: "reset" });
    expect(decideRateLimit(existing, WINDOW + 1, LIMIT, WINDOW)).toEqual({ kind: "reset" });
  });

  it("incrementa dentro de la ventana por debajo del límite", () => {
    expect(decideRateLimit({ count: 0, windowStartMs: 0 }, 5_000, LIMIT, WINDOW)).toEqual({ kind: "increment" });
    expect(decideRateLimit({ count: 19, windowStartMs: 0 }, 5_000, LIMIT, WINDOW)).toEqual({ kind: "increment" });
  });

  it("bloquea al alcanzar el límite, con el tiempo restante", () => {
    const decision = decideRateLimit({ count: 20, windowStartMs: 0 }, 10_000, LIMIT, WINDOW);
    expect(decision).toEqual({ kind: "blocked", retryAfterMs: 50_000 });
  });

  it("el retryAfter refleja lo que queda de ventana", () => {
    const decision = decideRateLimit({ count: 25, windowStartMs: 1_000 }, 41_000, LIMIT, WINDOW);
    // windowStart 1000, ahora 41000 -> transcurridos 40000, quedan 20000.
    expect(decision).toEqual({ kind: "blocked", retryAfterMs: 20_000 });
  });
});
