import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export function registerSecurity(app: FastifyInstance) {
  app.addHook('onRequest', async (req: FastifyRequest, res: FastifyReply) => {
    // CORS (tighten origins in prod)
    res.header('Vary', 'Origin');
    const allowList = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const reqOrigin = req.headers.origin as string | undefined;
    if (allowList.length > 0) {
      if (reqOrigin && allowList.includes(reqOrigin)) res.header('Access-Control-Allow-Origin', reqOrigin);
      else res.header('Access-Control-Allow-Origin', allowList[0]);
    } else {
      res.header('Access-Control-Allow-Origin', reqOrigin || '*');
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');

    // Security headers
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '0');
    res.header('Referrer-Policy', 'no-referrer');
    res.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.header('Cross-Origin-Opener-Policy', 'same-origin');
    res.header('Cross-Origin-Embedder-Policy', 'require-corp');
    res.header('Cross-Origin-Resource-Policy', 'same-site');
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // CSP (adjust nonces at runtime if templating SSR; API responses can be locked down)
    res.header(
      'Content-Security-Policy',
      [
        "default-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "img-src 'self' data:",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self'",
        "media-src 'self'",
        "object-src 'none'",
        "worker-src 'self'",
      ].join('; ')
    );

    if (req.method === 'OPTIONS') {
      res.code(204);
      return res.send();
    }
  });
}
