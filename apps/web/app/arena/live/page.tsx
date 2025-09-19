"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type AgentRef = { id: string; name: string };
type Match = { id: string; a: string; b: string; createdAt: number; bestOf?: number; rounds?: any[]; aRounds?: number; bRounds?: number; winner?: string };
type Agent = { id: string; name: string; url?: string; rating: number; notes?: string; certified?: boolean };
type Judge = { id: string; name: string; kind: string; url?: string; model?: string; certified?: boolean };

const API_CANDIDATES = [
  '', // same-origin relative (preferred when proxying backend)
  process.env.NEXT_PUBLIC_ARENA_API_URL,
  process.env.NEXT_PUBLIC_API_URL,
  'http://127.0.0.1:8083',
  'http://localhost:8083',
  'http://127.0.0.1:8082',
  'http://localhost:8082',
  'http://127.0.0.1:8081',
  'http://localhost:8081',
  'http://127.0.0.1:8080',
  'http://localhost:8080',
].filter((x): x is string => typeof x === 'string');

async function apiFetch(path: string, init?: RequestInit) {
  let lastErr: any = null;
  for (const base of API_CANDIDATES) {
    try {
      const headers = new Headers(init?.headers || {});
      const admin = process.env.NEXT_PUBLIC_ARENA_ADMIN_TOKEN as string | undefined;
      if (admin) headers.set('x-admin-token', admin);
      return await fetch(`${base}${path}`, { ...init, headers });
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('No API');
}

function wsUrlFor(base: string) {
  try {
    if (!base) {
      const { protocol, host } = window.location;
      const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProto}//${host}/ws/arena`;
    }
    const u = new URL(base);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.pathname = '/ws/arena';
    u.search = '';
    return u.toString();
  } catch { return 'ws://localhost:8083/ws/arena'; }
}

export default function ArenaLivePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [error, setError] = useState<string| null>(null);
  const [loading, setLoading] = useState(false);

  const [matchId, setMatchId] = useState("");
  const [round, setRound] = useState(1);
  const [timePerRound, setTimePerRound] = useState(120);
  const [judgeId, setJudgeId] = useState("");
  const [scores, setScores] = useState({ task_resolution: 5, efficiency: 5, creativity: 5, precision: 5 });

  const agentMap = useMemo(() => Object.fromEntries(agents.map(a => [a.id, a])), [agents]);
  const base = API_CANDIDATES[0] as string;
  const wsRef = useRef<WebSocket | null>(null);
  const [live, setLive] = useState<{ matchId: string; round: number; subject: string; endsAt: number; phase?: 'play'|'pause'; pauseEndsAt?: number } | null>(null);
  const [remain, setRemain] = useState<number>(0);
  const [phase, setPhase] = useState<'play'|'pause'|'idle'>('idle');
  const [auto, setAuto] = useState<{ enabled: boolean; division?: string; timePerRoundSec: number; pauseSec: number } | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      const r = await apiFetch('/api/arena/state', { cache: 'no-store' });
      const s = await r.json();
      setAgents(s.agents || []);
      setMatches(s.matches || []);
      setJudges(s.judges || []);
    } catch (e: any) {
      setError(e?.message || 'Load failed');
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    try {
      const url = wsUrlFor(base);
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as any);
          if (msg.type === 'live') { setLive(msg.live); setPhase(msg.live?.phase || 'play'); }
          if (msg.type === 'round_started') { setLive({ matchId: msg.matchId, round: msg.round, subject: msg.subject, endsAt: msg.endsAt, phase: 'play' }); setPhase('play'); }
          if (msg.type === 'tick') { setRemain(msg.remain); }
          if (msg.type === 'round_ended') { setRemain(0); setPhase('pause'); }
          if (msg.type === 'pause_started') { setPhase('pause'); }
          if (msg.type === 'pause_tick') { setRemain(msg.remain); }
          if (msg.type === 'pause_ended') { setRemain(0); setPhase('idle'); }
        } catch {}
      };
      return () => { try { ws.close(); } catch {} };
    } catch {}
  }, [base]);

  async function startRound() {
    if (!matchId) return;
    const r = await apiFetch('/api/arena/match/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId, round, timePerRoundSec: timePerRound }) });
    if (!r.ok) setError(`Start failed: ${r.status}`);
  }
  async function submitScore() {
    if (!matchId || !judgeId) return;
    const body = { matchId, round, judgeId, scores: { a: scores, b: scores } }; // single-judge mirror; UI is neutral, judges compare externally
    const r = await apiFetch('/api/arena/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) setError(`Score failed: ${r.status}`);
    else await refresh();
  }

  async function loadAuto() {
    try {
      const r = await apiFetch('/api/arena/autopilot');
      if (r.ok) setAuto(await r.json());
    } catch {}
  }
  useEffect(() => { loadAuto(); }, []);

  async function updateAuto(enabled: boolean) {
    const r = await apiFetch('/api/arena/autopilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled, timePerRoundSec: timePerRound, pauseSec: 30 }) });
    if (r.ok) setAuto(await r.json().then(x=>x.autopilot));
  }

  const gold = '#d4af37';
  const dark = '#0b0c10';
  const panel = '#111827';
  const border = '#1f2937';

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(1200px 800px at 10% -10%, #1a1a1a, ${dark})`, color: '#e5e7eb', fontFamily: 'ui-sans-serif, system-ui' }}>
      <div style={{ padding: 20, maxWidth: 1300, margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: gold, fontSize: 28 }}>🏛️</span>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: 1 }}>ARENA</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={()=>updateAuto(!(auto?.enabled))} style={{ background: auto?.enabled ? gold : 'transparent', color: auto?.enabled ? '#111827' : '#e5e7eb', border: `1px solid ${gold}`, borderRadius: 8, padding: '8px 12px' }}>{auto?.enabled ? 'Autopilot ON' : 'Autopilot OFF'}</button>
          </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Left: Roman style arena stage */}
          <div style={{ background: panel, border: `1px solid ${border}`, borderRadius: 12, padding: 16, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(600px 200px at 50% 0%, rgba(212,175,55,0.08), transparent)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ color: gold, fontWeight: 700 }}>⚔️ The Coliseum</div>
              <div style={{ color: '#9ca3af' }}>{phase === 'play' ? 'Round' : phase === 'pause' ? 'Intermission' : 'Idle'}</div>
            </div>
            {live ? (
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                  {agentMap[matches.find(m=>m.id===live!.matchId||'')?.a||'']?.name}
                  <span style={{ color: '#6b7280' }}> vs </span>
                  {agentMap[matches.find(m=>m.id===live!.matchId||'')?.b||'']?.name}
                </div>
                <div style={{ marginBottom: 8 }}>Subject: <b style={{ color: gold }}>{live.subject}</b></div>
                <div style={{ fontSize: 40, fontVariantNumeric: 'tabular-nums', textAlign: 'center', margin: '12px 0' }}>
                  {Math.floor(remain/60)}:{String(remain%60).padStart(2,'0')}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <span style={{ color: '#9ca3af' }}>Round</span>
                  <b>{live.round}</b>
                </div>
              </div>
            ) : (
              <div style={{ color: '#9ca3af' }}>No active phase. Turn on autopilot or start a round.</div>
            )}
          </div>

          {/* Right: Judges panel */}
          <div style={{ background: panel, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ color: gold, fontWeight: 700 }}>🌿 Judges</div>
              <div style={{ color: '#9ca3af' }}>Vote at end of round</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <select value={matchId} onChange={e=>setMatchId(e.target.value)} style={{ background: '#0f172a', color: '#e5e7eb', border: `1px solid ${border}`, borderRadius: 8, padding: 8 }}>
                <option value=''>Select match</option>
                {matches.map(m => (<option key={m.id} value={m.id}>{agentMap[m.a]?.name} vs {agentMap[m.b]?.name}</option>))}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type='number' min={1} max={9} value={round} onChange={e=>setRound(Number(e.target.value))} style={{ width: 100, background: '#0f172a', color: '#e5e7eb', border: `1px solid ${border}`, borderRadius: 8, padding: 8 }} />
                <input type='number' min={30} max={900} value={timePerRound} onChange={e=>setTimePerRound(Number(e.target.value))} style={{ width: 150, background: '#0f172a', color: '#e5e7eb', border: `1px solid ${border}`, borderRadius: 8, padding: 8 }} />
                <button onClick={startRound} style={{ background: gold, color: '#111827', borderRadius: 8, padding: '8px 12px' }}>Start Round</button>
              </div>
              <select value={judgeId} onChange={e=>setJudgeId(e.target.value)} style={{ background: '#0f172a', color: '#e5e7eb', border: `1px solid ${border}`, borderRadius: 8, padding: 8 }}>
                <option value=''>Select judge</option>
                {judges.map(j => (<option key={j.id} value={j.id}>{j.name} ({j.kind})</option>))}
              </select>
              <div style={{ display: 'grid', gap: 8 }}>
                {['task_resolution','efficiency','creativity','precision'].map(k => (
                  <label key={k} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 40px', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#e5e7eb' }}>{k.replace('_',' ')}</span>
                    <input type='range' min={0} max={10} value={(scores as any)[k]} onChange={e=> setScores(s=> ({...s, [k]: Number(e.target.value)}))} />
                    <span style={{ textAlign: 'right' }}>{(scores as any)[k]}</span>
                  </label>
                ))}
              </div>
              <button onClick={submitScore} disabled={phase!=='pause'} title={phase==='pause' ? 'Submit score' : 'Enabled after round ends'} style={{ background: phase==='pause' ? '#2563eb' : '#1f2937', color: '#e5e7eb', borderRadius: 8, padding: '10px 14px', border: `1px solid ${phase==='pause'? '#2563eb' : border}` }}>Submit Vote</button>
              {error && <div style={{ color: '#ef4444' }}>{error}</div>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
