import type { FastifyInstance } from 'fastify';

type Agent = { id: string; name: string; rating: number; notes?: string; url?: string; certified?: boolean };
type Judge = { id: string; name: string; kind: 'webhook'|'openai'|'anthropic'|'xai'|'deepseek'; url?: string; model?: string; certified?: boolean };
type RoundScore = { a: Record<string, number>; b: Record<string, number> };
type Match = { id: string; a: string; b: string; createdAt: number; bestOf?: number; rounds?: RoundScore[]; aRounds?: number; bRounds?: number; winner?: string };

function uid() { return Math.random().toString(36).slice(2, 10); }

export type LiveState = { matchId: string; round: number; subject: string; endsAt: number; phase?: 'play'|'pause' } | null;

export class ArenaService {
  agents: Agent[] = [];
  judges: Judge[] = [];
  matches: Match[] = [];
  autopilot = { enabled: false, timePerRoundSec: 120, pauseSec: 30 };
  live: LiveState = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private pauseTimer: NodeJS.Timeout | null = null;
  private broadcaster: ((msg: any) => void) | null = null;

  setBroadcaster(fn: (msg: any) => void) { this.broadcaster = fn; }
  private send(msg: any) { try { this.broadcaster?.(msg); } catch {} }

  reset() {
    this.agents = [];
    this.judges = [];
    this.matches = [];
    this.live = null;
    this.clearTimers();
  }

  clearTimers() { if (this.tickTimer) clearInterval(this.tickTimer); this.tickTimer = null; if (this.pauseTimer) clearInterval(this.pauseTimer); this.pauseTimer = null; }

  standings() {
    const map = new Map<string, { id: string; name: string; played: number; wins: number; losses: number; draws: number; points: number; rating: number }>();
    for (const a of this.agents) map.set(a.id, { id: a.id, name: a.name, played: 0, wins: 0, losses: 0, draws: 0, points: 0, rating: a.rating });
    for (const m of this.matches) {
      if (!map.has(m.a) || !map.has(m.b)) continue;
      const A = map.get(m.a)!; const B = map.get(m.b)!;
      if (!m.winner) continue; // only completed
      A.played++; B.played++;
      if (m.winner === m.a) { A.wins++; B.losses++; A.points += 3; }
      else if (m.winner === m.b) { B.wins++; A.losses++; B.points += 3; }
      else { A.draws++; B.draws++; A.points++; B.points++; }
    }
    return Array.from(map.values()).sort((x, y) => y.points - x.points || y.rating - x.rating);
  }

  startRound(matchId: string, round: number, timePerRoundSec: number) {
    const m = this.matches.find(x => x.id === matchId);
    if (!m) throw new Error('match not found');
    const subject = `Task ${round}`;
    const endsAt = Date.now() + timePerRoundSec * 1000;
    this.live = { matchId, round, subject, endsAt, phase: 'play' };
    this.send({ type: 'round_started', matchId, round, subject, endsAt });
    this.clearTimers();
    this.tickTimer = setInterval(() => {
      const remain = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      this.send({ type: 'tick', remain });
      if (Date.now() >= endsAt) {
        this.send({ type: 'round_ended', matchId, round });
        this.beginPause();
      }
    }, 1000);
  }

  beginPause() {
    this.clearTimers();
    this.live = this.live ? { ...this.live, phase: 'pause' } : null;
    const pauseEnd = Date.now() + (this.autopilot.pauseSec * 1000);
    this.send({ type: 'pause_started', endsAt: pauseEnd });
    this.pauseTimer = setInterval(() => {
      const remain = Math.max(0, Math.floor((pauseEnd - Date.now()) / 1000));
      this.send({ type: 'pause_tick', remain });
      if (Date.now() >= pauseEnd) {
        this.send({ type: 'pause_ended' });
        this.clearTimers();
        this.live = null;
      }
    }, 1000);
  }
}

export function registerArenaRoutes(app: FastifyInstance, arena: ArenaService) {
  // Basic health of arena service
  app.get('/api/arena/state', async () => ({ agents: arena.agents, matches: arena.matches, judges: arena.judges, live: arena.live }));
  app.get('/api/arena/standings', async () => ({ standings: arena.standings() }));

  app.post('/api/arena/reset', async () => { arena.reset(); return { ok: true }; });

  // Agents
  app.post('/api/arena/agent', async (req) => {
    const b = req.body as any;
    const a: Agent = { id: uid(), name: String(b?.name || 'Agent'), rating: 1200, notes: b?.notes || '', url: b?.url || '', certified: !!b?.certified };
    arena.agents.push(a);
    return { ok: true, agent: a };
  });
  app.post('/api/arena/agent/delete', async (req, reply) => {
    const id = (req.query as any)?.id as string;
    if (!id) return reply.code(400).send({ ok: false, error: 'missing id' });
    arena.agents = arena.agents.filter(a => a.id !== id);
    arena.matches = arena.matches.filter(m => m.a !== id && m.b !== id);
    return { ok: true };
  });

  // Judges
  app.post('/api/arena/judge', async (req) => {
    const b = req.body as any;
    const j: Judge = { id: uid(), name: String(b?.name || 'judge'), kind: (b?.kind || 'webhook'), url: b?.url || '', model: b?.model || '', certified: !!b?.certified } as Judge;
    arena.judges.push(j);
    return { ok: true, judge: j };
  });
  app.post('/api/arena/judge/delete', async (req, reply) => {
    const id = (req.query as any)?.id as string;
    if (!id) return reply.code(400).send({ ok: false, error: 'missing id' });
    arena.judges = arena.judges.filter(j => j.id !== id);
    return { ok: true };
  });

  // Matches
  app.post('/api/arena/match', async (req, reply) => {
    const b = req.body as any;
    const a = String(b?.a || '');
    const bId = String(b?.b || '');
    if (!a || !bId || a === bId) return reply.code(400).send({ ok: false, error: 'invalid agents' });
    const m: Match = { id: uid(), a, b: bId, createdAt: Date.now(), bestOf: Number(b?.bestOf || 3), rounds: [], aRounds: 0, bRounds: 0 };
    arena.matches.push(m);
    return { ok: true, match: m };
  });
  app.post('/api/arena/result', async (req, reply) => {
    const b = req.body as any;
    const m = arena.matches.find(x => x.id === b?.matchId);
    if (!m) return reply.code(404).send({ ok: false, error: 'match not found' });
    if (b?.winner && (b.winner === m.a || b.winner === m.b)) m.winner = b.winner;
    return { ok: true, match: m };
  });

  // Live controls
  app.post('/api/arena/match/start', async (req, reply) => {
    const { matchId, round, timePerRoundSec } = req.body as any;
    if (!matchId) return reply.code(400).send({ ok: false, error: 'missing matchId' });
    const sec = Math.max(10, Number(timePerRoundSec || arena.autopilot.timePerRoundSec));
    arena.startRound(String(matchId), Number(round || 1), sec);
    return { ok: true };
  });
  app.post('/api/arena/score', async (req, reply) => {
    const { matchId, round, judgeId, scores } = req.body as any;
    const m = arena.matches.find(x => x.id === matchId);
    if (!m) return reply.code(404).send({ ok: false, error: 'match not found' });
    const idx = Math.max(0, Number(round || 1) - 1);
    if (!m.rounds) m.rounds = [];
    m.rounds[idx] = scores as RoundScore;
    // naive winner decision by sum
    const sum = (o: Record<string, number>) => Object.values(o || {}).reduce((a, b) => a + b, 0);
    const aScore = sum(scores?.a || {});
    const bScore = sum(scores?.b || {});
    if (aScore > bScore) m.aRounds = (m.aRounds || 0) + 1; else if (bScore > aScore) m.bRounds = (m.bRounds || 0) + 1;
    const target = Math.ceil((m.bestOf || 3) / 2);
    if (m.aRounds! >= target) m.winner = m.a;
    if (m.bRounds! >= target) m.winner = m.b;
    return { ok: true, match: m };
  });

  // Utility endpoints used by UI
  app.post('/api/arena/match/run', async (req) => {
    // Minimal stub: create match if not exists and immediately assign random winner
    const { a, b } = req.body as any;
    const m: Match = { id: uid(), a: String(a), b: String(b), createdAt: Date.now(), bestOf: 1, rounds: [], aRounds: 0, bRounds: 0 };
    m.winner = Math.random() < 0.5 ? m.a : m.b;
    arena.matches.push(m);
    return { ok: true, match: m };
  });

  app.post('/api/arena/tournament/roundrobin', async (req) => {
    const { bestOf } = (req.body as any) || {};
    for (let i = 0; i < arena.agents.length; i++) {
      for (let j = i + 1; j < arena.agents.length; j++) {
        arena.matches.push({ id: uid(), a: arena.agents[i].id, b: arena.agents[j].id, createdAt: Date.now(), bestOf: Number(bestOf || 3), rounds: [], aRounds: 0, bRounds: 0 });
      }
    }
    return { ok: true };
  });

  app.post('/api/arena/match/fair', async (req) => {
    const { bestOf } = (req.body as any) || {};
    const sorted = [...arena.agents].sort((x, y) => x.rating - y.rating);
    for (let i = 0; i + 1 < sorted.length; i += 2) {
      arena.matches.push({ id: uid(), a: sorted[i].id, b: sorted[i + 1].id, createdAt: Date.now(), bestOf: Number(bestOf || 3), rounds: [], aRounds: 0, bRounds: 0 });
    }
    return { ok: true };
  });

  // Autopilot
  app.get('/api/arena/autopilot', async () => arena.autopilot);
  app.post('/api/arena/autopilot', async (req) => {
    const { enabled, timePerRoundSec, pauseSec } = (req.body as any) || {};
    if (typeof enabled === 'boolean') arena.autopilot.enabled = enabled;
    if (timePerRoundSec) arena.autopilot.timePerRoundSec = Number(timePerRoundSec);
    if (pauseSec) arena.autopilot.pauseSec = Number(pauseSec);
    return { ok: true, autopilot: arena.autopilot };
  });
}

