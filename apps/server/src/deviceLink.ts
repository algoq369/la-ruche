import type { FastifyInstance } from 'fastify';
import { mintToken, consumeToken } from './tokenStore.js';
import { query } from './db.js';

export function registerDeviceLinkRoutes(app: FastifyInstance) {
  // Initiate a link from an authenticated device
  app.post('/device/link/init', async (req, reply) => {
    const signed = req.cookies['lr_session'];
    const userId = req.unsignCookie(signed || '').value;
    if (!userId) return reply.code(401).send({ ok: false, error: 'unauthorized' });
    const sas = generateSAS();
    const ttlMs = 5 * 60_000; // 5 minutes
    const token = await mintToken('link', { userId, sas }, ttlMs);
    await query('INSERT INTO device_link_event (user_id, token, sas) VALUES ($1,$2,$3)', [userId, token, sas]);
    const qr = `la-ruche://link?token=${token}`;
    return { ok: true, data: { token, sas, qr, expiresIn: ttlMs / 1000 } };
  });

  // Complete link from the new device (scans QR or enters code)
  app.post('/device/link/complete', async (req, reply) => {
    const body = (req.body as any) || {};
    const token = body.token as string | undefined;
    if (!token) return reply.code(400).send({ ok: false, error: 'token required' });
    const entry = await consumeToken(token);
    if (!entry) return reply.code(404).send({ ok: false, error: 'invalid or expired token' });
    await query('UPDATE device_link_event SET completed_at=now() WHERE token=$1', [token]);
    // Create device record (unverified until user confirms SAS on both ends)
    const { rows } = await query<{ id: string }>('INSERT INTO device (user_id, name, verified) VALUES ($1,$2,$3) RETURNING id', [entry.userId, 'Linked Device', false]);
    return { ok: true, data: { userId: entry.userId, deviceId: rows[0].id, sas: entry.sas } };
  });
}

function generateSAS() {
  // 6-digit human-verifiable code in groups (e.g., 123-456)
  const n = Math.floor(Math.random() * 1_000_000);
  const s = n.toString().padStart(6, '0');
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}
