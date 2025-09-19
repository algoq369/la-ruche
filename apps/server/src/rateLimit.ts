import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type Counter = { count: number; resetAt: number };

export function registerRateLimit(app: FastifyInstance, opts?: { windowMs?: number; max?: number }) {
  const windowMs = opts?.windowMs ?? 60_000; // 1 minute
  const max = opts?.max ?? 120; // 120 requests/minute default
  const buckets = new Map<string, Counter>();

  app.addHook('onRequest', (req: FastifyRequest, reply: FastifyReply, done) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const now = Date.now();
    const b = buckets.get(ip) || { count: 0, resetAt: now + windowMs };
    if (now > b.resetAt) {
      b.count = 0;
      b.resetAt = now + windowMs;
    }
    b.count++;
    buckets.set(ip, b);
    const remaining = Math.max(0, max - b.count);
    reply.header('X-RateLimit-Limit', String(max));
    reply.header('X-RateLimit-Remaining', String(remaining));
    reply.header('X-RateLimit-Reset', String(Math.ceil(b.resetAt / 1000)));

    if (b.count > max) {
      reply.code(429).send({ ok: false, error: 'Too many requests' });
      return;
    }
    done();
  });
}

