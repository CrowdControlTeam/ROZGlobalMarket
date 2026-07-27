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

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.rateLimit.findUnique({ where: { key } });

    // Sin registro, o la ventana anterior ya expiró: arranca una nueva.
    if (!existing || now - existing.windowStart.getTime() >= windowMs) {
      await tx.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, windowStart: new Date(now) },
        update: { count: 1, windowStart: new Date(now) },
      });
      return { ok: true };
    }

    if (existing.count >= limit) {
      return { ok: false, retryAfterMs: windowMs - (now - existing.windowStart.getTime()) };
    }

    await tx.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    return { ok: true };
  });
}
