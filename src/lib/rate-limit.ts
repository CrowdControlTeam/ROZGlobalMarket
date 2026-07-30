import { prisma } from "@/lib/prisma";

// Limitador de tipo "ventana fija" respaldado en BD (modelo RateLimit): se
// elige BD en vez de un contador en memoria para que funcione entre
// instancias (serverless/Cloudflare Workers), donde la memoria se reinicia
// por instancia y un Map local no limitaría nada de forma fiable.
//
// `key` identifica el límite (p.ej. "recognize:<discordId>"); dentro de una
// ventana de `windowMs` se permiten hasta `limit` peticiones. Toda la lógica
// va en una transacción para que el incremento sea atómico bajo concurrencia.

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number };

export type RateLimitDecision =
  | { kind: "reset" } // arranca ventana nueva (count = 1)
  | { kind: "increment" } // dentro de ventana y por debajo del límite
  | { kind: "blocked"; retryAfterMs: number };

// Lógica pura de la ventana fija, separada del acceso a BD para poder
// testearla sin base de datos.
export function decideRateLimit(
  existing: { count: number; windowStartMs: number } | null,
  nowMs: number,
  limit: number,
  windowMs: number,
): RateLimitDecision {
  if (!existing || nowMs - existing.windowStartMs >= windowMs) {
    return { kind: "reset" };
  }
  if (existing.count >= limit) {
    return { kind: "blocked", retryAfterMs: windowMs - (nowMs - existing.windowStartMs) };
  }
  return { kind: "increment" };
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.rateLimit.findUnique({ where: { key } });
    const decision = decideRateLimit(
      existing ? { count: existing.count, windowStartMs: existing.windowStart.getTime() } : null,
      now,
      limit,
      windowMs,
    );

    if (decision.kind === "blocked") {
      return { ok: false, retryAfterMs: decision.retryAfterMs };
    }

    if (decision.kind === "reset") {
      await tx.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, windowStart: new Date(now) },
        update: { count: 1, windowStart: new Date(now) },
      });
    } else {
      await tx.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    }

    return { ok: true };
  });
}
