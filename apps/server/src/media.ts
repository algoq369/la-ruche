import type { FastifyInstance } from 'fastify';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const region = process.env.S3_REGION || 'us-east-1';
const bucket = process.env.S3_BUCKET || '';
const endpoint = process.env.S3_ENDPOINT || undefined;
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

const creds = process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
  ? { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! }
  : undefined;

const s3 = new S3Client({ region, endpoint, forcePathStyle, credentials: creds });

export function registerMediaRoutes(app: FastifyInstance) {
  app.post('/media/upload-url', async (req, reply) => {
    const signed = req.cookies['lr_session'];
    const userId = req.unsignCookie(signed || '').value;
    if (!userId) return reply.code(401).send({ ok: false, error: 'unauthorized' });
    if (!bucket) return reply.code(500).send({ ok: false, error: 'S3 bucket not configured' });
    const body = (req.body as any) || {};
    const contentType = typeof body.contentType === 'string' ? body.contentType : 'application/octet-stream';
    const objectKey = `media/${userId}/${Date.now()}_${crypto.randomUUID()}`;
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: contentType });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });
    return { ok: true, data: { url, key: objectKey, expiresIn: 60 } };
  });

  app.get('/media/download-url', async (req, reply) => {
    const signed = req.cookies['lr_session'];
    const userId = req.unsignCookie(signed || '').value;
    if (!userId) return reply.code(401).send({ ok: false, error: 'unauthorized' });
    if (!bucket) return reply.code(500).send({ ok: false, error: 'S3 bucket not configured' });
    const key = (req.query as any)?.key as string | undefined;
    if (!key) return reply.code(400).send({ ok: false, error: 'key required' });
    // In production, enforce authorization: verify the user can access this key
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });
    return { ok: true, data: { url, key, expiresIn: 60 } };
  });
}

