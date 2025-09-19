import type { FastifyInstance } from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import { consumeWsToken } from './session.js';

type Client = { socket: WebSocket; user?: string };

export function registerWebSocket(app: FastifyInstance) {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<Client>();

  app.server.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/ws')) return; // only handle /ws
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (socket, request) => {
    const c: Client = { socket };
    clients.add(c);

    socket.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        // Expected minimal format: { type: 'auth'|'send', token?, to?, envelope? }
        if (msg.type === 'auth') {
          if (typeof msg.token !== 'string') {
            socket.send(JSON.stringify({ type: 'error', error: 'missing token' }));
            return;
          }
          consumeWsToken(msg.token).then((userId) => {
            if (!userId) {
              socket.send(JSON.stringify({ type: 'error', error: 'invalid token' }));
              socket.close();
              return;
            }
            c.user = userId;
            socket.send(JSON.stringify({ type: 'auth_ok' }));
          }).catch(() => {
            socket.send(JSON.stringify({ type: 'error', error: 'invalid token' }));
            socket.close();
          });
        } else if (msg.type === 'send') {
          // Relay ciphertext envelope without reading
          if (!c.user) {
            socket.send(JSON.stringify({ type: 'error', error: 'unauthenticated' }));
            return;
          }
          const target = [...clients].find((x) => x.user === msg.to);
          target?.socket.send(JSON.stringify({ type: 'message', envelope: msg.envelope }));
          socket.send(JSON.stringify({ type: 'sent', id: msg.envelope?.id }));
        }
      } catch (_) {
        // ignore
      }
    });

    socket.on('close', () => {
      clients.delete(c);
    });
  });
}
