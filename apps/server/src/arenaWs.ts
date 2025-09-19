import type { FastifyInstance } from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import type { ArenaService } from './arena.js';

type Client = { socket: WebSocket };

export function registerArenaWebSocket(app: FastifyInstance, arena: ArenaService) {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<Client>();

  const broadcast = (msg: any) => {
    const data = JSON.stringify(msg);
    for (const c of clients) {
      try { c.socket.send(data); } catch {}
    }
  };
  arena.setBroadcaster((msg) => broadcast(msg));

  app.server.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/ws/arena')) return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (socket) => {
    const c: Client = { socket };
    clients.add(c);
    // Send initial live state if any
    try { if (arena.live) socket.send(JSON.stringify({ type: 'live', live: arena.live })); } catch {}
    socket.on('close', () => { clients.delete(c); });
  });
}

