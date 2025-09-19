import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { registerSecurity } from './security.js';
import { registerWebAuthnRoutes } from './webauthn.js';
import { registerWebSocket } from './ws.js';
import { ArenaService, registerArenaRoutes } from './arena.js';
import { registerArenaWebSocket } from './arenaWs.js';
import { registerRateLimit } from './rateLimit.js';
import { registerSessionRoutes } from './session.js';
import { registerDeviceLinkRoutes } from './deviceLink.js';
import { registerDevicesRoutes } from './devices.js';
import { registerMediaRoutes } from './media.js';
import { registerKeysRoutes } from './keys.js';
import { registerMeRoute } from './me.js';

const app = Fastify({ logger: true });

await app.register(cookie, { secret: process.env.COOKIE_SECRET || 'dev' });
registerSecurity(app);
registerRateLimit(app, { windowMs: 60_000, max: 120 });
registerWebAuthnRoutes(app);
registerSessionRoutes(app);
registerDeviceLinkRoutes(app);
registerDevicesRoutes(app);
registerMediaRoutes(app);
registerKeysRoutes(app);
registerMeRoute(app);
registerWebSocket(app);

// Arena (in-memory, no API keys needed)
const arena = new ArenaService();
registerArenaRoutes(app, arena);
registerArenaWebSocket(app, arena);

// Health endpoints
app.get('/health', async () => ({ ok: true, ts: Date.now() }));
app.get('/api/health', async () => ({ ok: true, ts: Date.now() }));

const port = Number(process.env.PORT || 3001);
app.listen({ port, host: '0.0.0.0' }).then(() => {
  app.log.info(`Server listening on :${port}`);
});
