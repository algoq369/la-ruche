import type { FastifyInstance } from 'fastify';
import { listDevices } from './db.js';

export function registerDevicesRoutes(app: FastifyInstance) {
  app.get('/devices', async (req, reply) => {
    const signed = req.cookies['lr_session'];
    const userId = req.unsignCookie(signed || '').value;
    if (!userId) return reply.code(401).send({ ok: false, error: 'unauthorized' });
    const items = await listDevices(userId);
    return { ok: true, data: items };
  });
}

