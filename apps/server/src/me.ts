import type { FastifyInstance } from 'fastify';
import { getUserById } from './db.js';

export function registerMeRoute(app: FastifyInstance) {
  app.get('/me', async (req, reply) => {
    const signed = req.cookies['lr_session'];
    const userId = req.unsignCookie(signed || '').value;
    if (!userId) return reply.code(401).send({ ok: false, error: 'unauthorized' });
    const user = await getUserById(userId);
    if (!user) return reply.code(404).send({ ok: false, error: 'unknown user' });
    return { ok: true, data: user };
  });
}

