"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Agent = {
  id: string;
  name: string;
  rating: number; // ELO-like rating
  notes?: string;
  url?: string;
};

type Judge = {
  id: string;
  name: string;
  kind: 'webhook'|'openai'|'anthropic'|'xai'|'deepseek';
  url?: string;
  model?: string;
};

type Standing = { id: string; name: string; played: number; wins: number; losses: number; draws: number; points: number; rating: number };

type Match = {
  id: string;
  a: string; // agent id
  b: string; // agent id
  winner?: string; // agent id
  createdAt: number;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const API_CANDIDATES = [
  '', // same-origin relative (preferred in prod behind proxy)
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
      const admin = process.env.NEXT_PUBLIC_ARENA_ADMIN_TOKEN;
      if (admin) headers.set('x-admin-token', admin);
      const r = await fetch(`${base}${path}`, { ...init, headers });
      return r;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('No API endpoint reachable');
}

export default function ArenaPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [url, setUrl] = useState("");
  const [certified, setCertified] = useState(false);

  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [bestOf, setBestOf] = useState(3);

  const [judges, setJudges] = useState<Judge[]>([]);
  const [jName, setJName] = useState("");
  const [jKind, setJKind] = useState<Judge['kind']>('webhook');
  const [jUrl, setJUrl] = useState("");
  const [jModel, setJModel] = useState("");
  const [jCertified, setJCertified] = useState(false);

  const [standings, setStandings] = useState<Standing[]>([]);

  const agentMap = useMemo(() => Object.fromEntries(agents.map(a => [a.id, a])), [agents]);

  async function refresh() {
    try {
      setLoading(true);
      const r = await apiFetch(`/api/arena/state`, { cache: 'no-store' });
      if (r.ok) {
        const s = await r.json();
        setAgents(s.agents || []);
        setMatches(s.matches || []);
        setJudges(s.judges || []);
        setError(null);
      } else {
        setError(`Failed to load: ${r.status}`);
      }
      const r2 = await apiFetch(`/api/arena/standings`, { cache: 'no-store' });
      if (r2.ok) {
        const st = await r2.json();
        setStandings(st.standings || []);
      }
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function addAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setLoading(true);
      const r = await apiFetch(`/api/arena/agent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), notes: notes.trim(), url: url.trim(), certified })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await refresh();
      setName("");
      setNotes("");
      setUrl("");
      setCertified(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to add agent');
    } finally {
      setLoading(false);
    }
  }

  async function createMatch() {
    if (!aId || !bId || aId === bId) return;
    try {
      setLoading(true);
      const r = await apiFetch(`/api/arena/match`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: aId, b: bId, bestOf })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await refresh();
      setAId("");
      setBId("");
    } catch (e: any) {
      setError(e?.message || 'Failed to create match');
    } finally {
      setLoading(false);
    }
  }

  async function recordResult(matchId: string, winnerId: string) {
    try {
      setLoading(true);
      const r = await apiFetch(`/api/arena/result`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, winner: winnerId })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to record result');
    } finally {
      setLoading(false);
    }
  }

  async function runMatch() {
    if (!aId || !bId || aId === bId) return;
    try {
      setLoading(true);
      const r = await apiFetch(`/api/arena/match/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: aId, b: bId })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await refresh();
      setAId("");
      setBId("");
    } catch (e: any) {
      setError(e?.message || 'Failed to run match');
    } finally {
      setLoading(false);
    }
  }

  async function deleteAgent(id: string) {
    try {
      setLoading(true);
      const r = await apiFetch(`/api/arena/agent/delete?id=${encodeURIComponent(id)}`, { method: 'POST' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete agent');
    } finally {
      setLoading(false);
    }
  }

  async function resetArena() {
    try {
      setLoading(true);
      const r = await apiFetch(`/api/arena/reset`, { method: 'POST' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to reset');
    } finally {
      setLoading(false);
    }
  }

  async function generateRoundRobin() {
    try {
      setLoading(true);
      const r = await apiFetch(`/api/arena/tournament/roundrobin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bestOf }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to generate');
    } finally { setLoading(false); }
  }

  async function createFair() {
    try {
      setLoading(true);
      const r = await apiFetch(`/api/arena/match/fair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bestOf }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to create fair match');
    } finally { setLoading(false); }
  }

  async function addJudge(e: React.FormEvent) {
    e.preventDefault();
    if (!jName.trim()) return;
    try {
      setLoading(true);
      const r = await apiFetch(`/api/arena/judge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: jName.trim(), kind: jKind, url: jUrl.trim(), model: jModel.trim(), certified: jCertified })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setJName(""); setJUrl(""); setJModel(""); setJCertified(false);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to add judge');
    } finally { setLoading(false); }
  }

  async function deleteJudge(id: string) {
    try { setLoading(true);
      const r = await apiFetch(`/api/arena/judge/delete?id=${encodeURIComponent(id)}`, { method: 'POST' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await refresh();
    } catch (e: any) { setError(e?.message || 'Failed to delete judge'); }
    finally { setLoading(false); }
  }

  const sorted = [...agents].sort((x, y) => y.rating - x.rating);

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto", fontFamily: "ui-sans-serif, system-ui" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Agents Arena</h1>
        <Link href="/" style={{ color: "#2563eb" }}>Home</Link>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ gridColumn: '1 / -1', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Standings</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Agent</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Division</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>P</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>W</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>D</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>L</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Pts</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Rating</th>
                </tr>
              </thead>
              <tbody>
                {standings.map(s => (
                  <tr key={s.id}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{s.name}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{(s as any).division || '-'}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{s.played}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{s.wins}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{s.draws}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{s.losses}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #f3f4f6', fontWeight: 600 }}>{s.points}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{s.rating}</td>
                  </tr>
                ))}
                {standings.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '6px 8px', color: '#6b7280' }}>No matches yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {(loading || error) && (
          <div style={{ gridColumn: "1 / -1", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: loading ? '#2563eb' : '#ef4444' }}>{loading ? 'Syncing…' : error}</div>
            <button onClick={refresh} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px' }}>Refresh</button>
          </div>
        )}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Agents</h2>
          <form onSubmit={addAgent} style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            <input placeholder="Name (e.g., GPT-4o Strategy)" value={name} onChange={e => setName(e.target.value)}
                   style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }} />
            <textarea placeholder="Notes (capabilities, prompting, tools)" value={notes} onChange={e => setNotes(e.target.value)}
                      style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: 8, minHeight: 70 }} />
            <input placeholder="Agent URL (for auto matches)" value={url} onChange={e => setUrl(e.target.value)}
                   style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={certified} onChange={e=>setCertified(e.target.checked)} />
              Cybersecurity certified
            </label>
            <button type="submit" style={{ background: "#111827", color: "white", borderRadius: 6, padding: "8px 12px" }}>Add Agent</button>
          </form>

          <ol style={{ display: "grid", gap: 8 }}>
            {sorted.map(a => (
              <li key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: "1px solid #e5e7eb", borderRadius: 6, padding: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name} {a as any && (a as any).certified ? '✅' : '⚠️'}</div>
                  <div style={{ color: "#6b7280", fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.notes || "—"}</div>
                  {a.url && <div style={{ color: "#6b7280", fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>URL: {a.url}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontVariantNumeric: "tabular-nums" }}>⚔️ {a.rating}</div>
                  <button onClick={() => deleteAgent(a.id)} title="Delete" style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px' }}>Delete</button>
                </div>
              </li>
            ))}
            {sorted.length === 0 && <div style={{ color: "#6b7280" }}>No agents yet. Add one above.</div>}
          </ol>
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Matches</h2>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <select value={aId} onChange={e => setAId(e.target.value)} style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }}>
              <option value="">Select Agent A</option>
              {agents.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
            </select>
            <select value={bId} onChange={e => setBId(e.target.value)} style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }}>
              <option value="">Select Agent B</option>
              {agents.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
            </select>
            <select value={bestOf} onChange={e => setBestOf(Number(e.target.value))} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }}>
              {[1,3,5,7,9].map(n => <option key={n} value={n}>Best of {n}</option>)}
            </select>
            <button onClick={createMatch} style={{ background: "#111827", color: "white", borderRadius: 6, padding: "8px 12px" }}
                    disabled={!aId || !bId || aId === bId}>Create</button>
            <button onClick={runMatch} style={{ background: "#2563eb", color: "white", borderRadius: 6, padding: "8px 12px" }}
                    disabled={!aId || !bId || aId === bId}>Run</button>
            <button onClick={resetArena} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px' }}>Reset</button>
            <button onClick={generateRoundRobin} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px' }}>Round-robin</button>
            <button onClick={createFair} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px' }}>Fair Match</button>
          </div>

          <ul style={{ display: "grid", gap: 8 }}>
            {matches.map(m => {
              const A = agentMap[m.a];
              const B = agentMap[m.b];
              return (
                <li key={m.id} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{A?.name} vs {B?.name}</div>
                      <div style={{ color: "#6b7280", fontSize: 12 }}>{new Date(m.createdAt).toLocaleString()}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => recordResult(m.id, m.a)} disabled={!!m.winner}
                              style={{ background: "#10b981", color: "white", borderRadius: 6, padding: "6px 10px" }}>
                        {A?.name} wins
                      </button>
                      <button onClick={() => recordResult(m.id, m.b)} disabled={!!m.winner}
                              style={{ background: "#ef4444", color: "white", borderRadius: 6, padding: "6px 10px" }}>
                        {B?.name} wins
                      </button>
                    </div>
                  </div>
                  {m.winner && (
                    <div style={{ marginTop: 6, color: "#111827" }}>Winner: <b>{agentMap[m.winner]?.name}</b></div>
                  )}
                </li>
              );
            })}
            {matches.length === 0 && <div style={{ color: "#6b7280" }}>No matches yet. Create one above.</div>}
          </ul>

          <p style={{ marginTop: 12, color: "#6b7280" }}>
            Tip: Start with simple baselines (rule-based, different prompts). Later we can plug in real agents and auto-evaluate tasks.
          </p>
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, gridColumn: '1 / -1' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Judges</h2>
          <form onSubmit={addJudge} style={{ display: 'grid', gap: 8, marginBottom: 12, gridTemplateColumns: '1.5fr 1fr 1.5fr 1fr auto auto' }}>
            <input placeholder='Name' value={jName} onChange={e=>setJName(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 8 }} />
            <select value={jKind} onChange={e=>setJKind(e.target.value as Judge['kind'])} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 8 }}>
              <option value='webhook'>webhook</option>
              <option value='openai'>openai</option>
              <option value='anthropic'>anthropic</option>
              <option value='xai'>xai</option>
              <option value='deepseek'>deepseek</option>
            </select>
            <input placeholder='URL (for webhook)' value={jUrl} onChange={e=>setJUrl(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 8 }} />
            <input placeholder='Model (optional)' value={jModel} onChange={e=>setJModel(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 8 }} />
            <button type='submit' style={{ background: '#111827', color: 'white', borderRadius: 6, padding: '8px 12px' }}>Add</button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type='checkbox' checked={jCertified} onChange={e=>setJCertified(e.target.checked)} /> Certified
            </label>
          </form>
          <ul style={{ display: 'grid', gap: 8 }}>
            {judges.map(j => (
              <li key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e5e7eb', borderRadius: 6, padding: 10 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{j.name} <span style={{ color: '#6b7280', fontWeight: 400 }}>({j.kind}{j.model ? `:${j.model}` : ''})</span></div>
                  {j.url && <div style={{ color: '#6b7280', fontSize: 12 }}>URL: {j.url}</div>}
                </div>
                <button onClick={()=>deleteJudge(j.id)} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px' }}>Delete</button>
              </li>
            ))}
            {judges.length === 0 && <div style={{ color: '#6b7280' }}>No judges yet. Add up to 10.</div>}
          </ul>
        </div>
      </section>

      <section style={{ marginTop: 24, borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Next steps</h3>
        <ul style={{ listStyle: "disc", paddingLeft: 18, color: "#374151" }}>
          <li>Persist agents and matches (localStorage, then backend).</li>
          <li>Define standardized tasks and judges (pairwise comparisons or metrics).</li>
          <li>Auto-run bouts via queue and collect results.</li>
          <li>Track learning curves, ELO over time, and champion-of-the-hill.</li>
        </ul>
      </section>
    </div>
  );
}
