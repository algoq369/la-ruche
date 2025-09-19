"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { createEngine } from '@la-ruche/crypto-core';
import { publishPrekeys, fetchBundle } from '@la-ruche/crypto-core/src/keyApi';

export default function ChatPage() {
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [me, setMe] = useState<{ id: string; username: string } | null>(null);
  const [peerUserId, setPeerUserId] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const engine = useMemo(() => createEngine(true), []);

  useEffect(() => {
    // Load current user
    fetch(api('/me'), { credentials: 'include' }).then(r => r.json()).then(j => { if (j.ok) setMe(j.data); });

    let closed = false;
    async function connect() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const tokenResp = await fetch(`${apiBase}/auth/ws-token`, {
          method: 'POST',
          credentials: 'include',
        }).then((r) => r.json());
        if (!tokenResp.ok) {
          setWsStatus('unauthorized');
          return;
        }
        const token: string = tokenResp.data.token;
        const url = (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001') + '/ws';
        const ws = new WebSocket(url);
        wsRef.current = ws;
        ws.onopen = () => {
          if (closed) return;
          setWsStatus('connected');
          ws.send(JSON.stringify({ type: 'auth', token }));
        };
        ws.onmessage = async (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'message') {
              const env = msg.envelope;
              const plain = await engine.decrypt({ peerDeviceId: 'peer', sessionId: 'peer' }, base64ToBytes(env.ciphertext));
              setMessages((m) => [...m, `Peer: ${new TextDecoder().decode(plain)}`]);
            } else if (msg.type === 'error') {
              setWsStatus(`error: ${msg.error}`);
            }
          } catch {}
        };
        ws.onclose = () => setWsStatus('disconnected');
      } catch (e) {
        setWsStatus('error');
      }
    }
    connect();
    return () => {
      closed = true;
      wsRef.current?.close();
    };
  }, [engine]);

  async function send() {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== ws.OPEN) return;
    if (!peerUserId) { alert('Enter peer userId first'); return; }

    // DEV ensure key publish and fetch peer bundle
    await ensureDevPublished();
    await ensureDevBundle(peerUserId);
    // Mock encrypt
    const cipher = await engine.encrypt({ peerDeviceId: 'peer', sessionId: 'peer' }, new TextEncoder().encode(input));
    const envelope = { id: crypto.randomUUID(), ciphertext: bytesToBase64(cipher) };
    ws.send(JSON.stringify({ type: 'send', to: peerUserId, envelope }));
    setMessages((m) => [...m, `Me: ${input}`]);
    setInput('');
  }

  async function ensureDevPublished() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const random = (n: number) => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(n))));
    const prekeys = Array.from({ length: 3 }).map((_, i) => ({ id: i + 1, keyB64: random(32) }));
    await publishPrekeys(apiBase, {
      deviceName: 'Web Dev Device',
      identityPubB64: random(32),
      signedPrekeyPubB64: random(32),
      signedPrekeySigB64: random(64),
      prekeys,
    });
  }

  async function ensureDevBundle(targetUserId: string) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    await fetchBundle(apiBase, targetUserId);
  }

  return (
    <div>
      <h1>Chat (demo)</h1>
      <div>Status: {wsStatus} {me ? `| Me: ${me.id}` : ''}</div>
      <div style={{ marginTop: 8 }}>
        <input placeholder="Peer userId" value={peerUserId} onChange={(e) => setPeerUserId(e.target.value)} style={{ padding: 8, width: '60%' }} />
      </div>
      <div style={{ border: '1px solid #ddd', padding: 8, minHeight: 200, marginTop: 8 }}>
        {messages.map((m, i) => (
          <div key={i}>{m}</div>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} style={{ padding: 8, width: '70%' }} />
        <button onClick={send} style={{ padding: 8, marginLeft: 8 }}>Send</button>
      </div>
      <p style={{ color: '#b00' }}>
        Demo uses insecure mock crypto. Integrate libsignal-client for production E2EE.
      </p>
    </div>
  );
}

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}
function base64ToBytes(b64: string) {
  return new Uint8Array(atob(b64).split('').map((c) => c.charCodeAt(0)));
}
