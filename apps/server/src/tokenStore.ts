import Redis from 'ioredis';

type TokenData = { userId: string; sas?: string };

let redis: Redis | null = null;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, { lazyConnect: true });
  redis.on('error', (e) => console.error('Redis error', e));
}

function encode(value: TokenData) {
  return JSON.stringify(value);
}
function decode(s: string | null): TokenData | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

export async function mintToken(prefix: string, data: TokenData, ttlMs: number): Promise<string> {
  const token = `${prefix}_${base64url(crypto.getRandomValues(new Uint8Array(24)))}`;
  if (redis) {
    try {
      if (!redis.status || redis.status === 'end') await redis.connect();
      await redis.set(token, encode(data), 'PX', ttlMs);
      return token;
    } catch (_) { /* fallthrough to memory */ }
  }
  mem.set(token, { exp: Date.now() + ttlMs, data });
  return token;
}

export async function consumeToken(token: string): Promise<TokenData | null> {
  if (redis) {
    try {
      if (!redis.status || redis.status === 'end') await redis.connect();
      const val = await redis.get(token);
      if (!val) return null;
      await redis.del(token);
      return decode(val);
    } catch (_) { /* fallthrough to memory */ }
  }
  const entry = mem.get(token);
  if (!entry) return null;
  mem.delete(token);
  if (Date.now() > entry.exp) return null;
  return entry.data;
}

const mem = new Map<string, { exp: number; data: TokenData }>();

function base64url(bytes: Uint8Array): string {
  const bin = Buffer.from(bytes).toString('base64');
  return bin.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

