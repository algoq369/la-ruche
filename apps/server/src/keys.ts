import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from './db.js';

const publishSchema = z.object({
  deviceId: z.string().uuid().optional(),
  deviceName: z.string().min(1).max(100).optional(),
  identityPubB64: z.string().min(16),
  signedPrekeyPubB64: z.string().min(16),
  signedPrekeySigB64: z.string().min(16),
  prekeys: z.array(z.object({ id: z.number().int().nonnegative(), keyB64: z.string().min(16) })).min(1),
});

export function registerKeysRoutes(app: FastifyInstance) {
  // Client publishes identity/signed prekey/one-time prekeys
  app.post('/keys/publish', async (req, reply) => {
    const signed = req.cookies['lr_session'];
    const userId = req.unsignCookie(signed || '').value;
    if (!userId) return reply.code(401).send({ ok: false, error: 'unauthorized' });
    const body = publishSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: 'invalid payload' });
    const p = body.data as any;

    // Ensure device exists or create
    let deviceId = p.deviceId;
    if (!deviceId) {
      const { rows } = await query<{ id: string }>(
        'INSERT INTO device (user_id, name, verified) VALUES ($1,$2,$3) RETURNING id',
        [userId, p.deviceName || 'Web Device', false]
      );
      deviceId = rows[0].id;
    } else {
      // ensures device belongs to user
      const { rows } = await query('SELECT id FROM device WHERE id=$1 AND user_id=$2', [deviceId, userId]);
      if (!rows[0]) return reply.code(403).send({ ok: false, error: 'forbidden' });
    }

    const identity_pub = Buffer.from(p.identityPubB64, 'base64');
    const spk_pub = Buffer.from(p.signedPrekeyPubB64, 'base64');
    const spk_sig = Buffer.from(p.signedPrekeySigB64, 'base64');

    await query('UPDATE device SET identity_pub=$2, spk_pub=$3, spk_sig=$4, last_seen=now() WHERE id=$1', [deviceId, identity_pub, spk_pub, spk_sig]);

    // Insert prekeys (ignore duplicates)
    const values: any[] = [];
    const chunks: string[] = [];
    p.prekeys.forEach((k: any, i: number) => {
      values.push(deviceId, userId, k.id, Buffer.from(k.keyB64, 'base64'));
      chunks.push(`($${values.length-3}, $${values.length-2}, $${values.length-1}, $${values.length})`);
    });
    if (values.length) {
      await query(
        `INSERT INTO prekey (device_id, user_id, key_id, pubkey)
         VALUES ${chunks.join(', ')}
         ON CONFLICT (device_id, key_id) DO NOTHING`,
        values
      );
    }
    return { ok: true, data: { deviceId } };
  });

  // Fetch a bundle for a given user (for starting a new session to one of their devices)
  app.get('/keys/:userId/bundle', async (req, reply) => {
    const targetUserId = (req.params as any).userId as string;
    // Select a device with available prekeys
    const { rows: devices } = await query<{ id: string; identity_pub: Buffer; spk_pub: Buffer; spk_sig: Buffer }>(
      `SELECT d.id, d.identity_pub, d.spk_pub, d.spk_sig
       FROM device d
       WHERE d.user_id=$1 AND d.identity_pub IS NOT NULL AND d.spk_pub IS NOT NULL AND d.spk_sig IS NOT NULL
       ORDER BY d.created_at ASC
       LIMIT 5`,
      [targetUserId]
    );
    if (devices.length === 0) return reply.code(404).send({ ok: false, error: 'no device with keys' });

    // Find a device with an unused prekey; if none, return bundle without one-time
    for (const dev of devices) {
      const { rows: pk } = await query<{ key_id: number; pubkey: Buffer; used: boolean }>(
        'SELECT key_id, pubkey, used FROM prekey WHERE device_id=$1 AND user_id=$2 AND used=false ORDER BY key_id ASC LIMIT 1',
        [dev.id, targetUserId]
      );
      let oneTimePrekey: { id: number; keyB64: string } | undefined = undefined;
      if (pk[0]) {
        // Mark as used
        await query('UPDATE prekey SET used=true WHERE device_id=$1 AND key_id=$2', [dev.id, pk[0].key_id]);
        oneTimePrekey = { id: pk[0].key_id, keyB64: pk[0].pubkey.toString('base64') };
      }
      return reply.send({
        ok: true,
        data: {
          userId: targetUserId,
          deviceId: dev.id,
          identityPubB64: dev.identity_pub.toString('base64'),
          signedPrekeyPubB64: dev.spk_pub.toString('base64'),
          signedPrekeySigB64: dev.spk_sig.toString('base64'),
          oneTimePrekey,
        },
      });
    }
    return reply.code(404).send({ ok: false, error: 'no prekeys available' });
  });
}
