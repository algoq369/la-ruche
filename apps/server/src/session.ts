import type { FastifyInstance } from 'fastify';
import { mintToken, consumeToken } from './tokenStore.js';

export function registerSessionRoutes(app: FastifyInstance) {
  app.post('/auth/ws-token', async (req, reply) => {
    const signed = req.cookies['lr_session'];
    const userId = req.unsignCookie(signed || '').value;
    if (!userId) return reply.code(401).send({ ok: false, error: 'unauthorized' });
    const ttlMs = 60_000; // 60s
    const token = await mintToken('ws', { userId }, ttlMs);
    return { ok: true, data: { token, expiresIn: ttlMs / 1000 } };
  });
}

export async function consumeWsToken(token: string): Promise<string | null> {
  const data = await consumeToken(token);
  return data?.userId ?? null;
}
