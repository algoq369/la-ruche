"use client";

import { useState } from 'react';
import { publishPrekeys, fetchBundle as fetchBundleApi } from '@la-ruche/crypto-core/src/keyApi';

export default function KeysDevPage() {
  const [status, setStatus] = useState('');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState('');
  const [bundle, setBundle] = useState<any>(null);

  async function publish() {
    setStatus('Publishing dev keys (placeholder)…');
    // DEV-ONLY placeholder keys to exercise the API; replace with libsignal-client bundle
    const random = (n: number) => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(n))));
    const prekeys = Array.from({ length: 5 }).map((_, i) => ({ id: i + 1, keyB64: random(32) }));
    const body = {
      deviceName: 'Web Dev Device',
      identityPubB64: random(32),
      signedPrekeyPubB64: random(32),
      signedPrekeySigB64: random(64),
      prekeys,
    };
    const r = await publishPrekeys(apiBase(), body);
    if (!r.ok) setStatus(r.error || 'Publish failed');
    else {
      setDeviceId(r.data.deviceId);
      setStatus(`Published dev keys for device ${r.data.deviceId}`);
    }
  }

  async function fetchBundle() {
    setStatus('Fetching bundle…');
    const r = await fetchBundleApi(apiBase(), targetUserId);
    if (!r.ok) setStatus(r.error || 'Fetch failed');
    else {
      setBundle(r.data);
      setStatus('Bundle fetched');
    }
  }

  return (
    <div>
      <h1>Keys (Dev)</h1>
      <p style={{ color: '#b00' }}>Development helper to exercise key endpoints. Replace with real libsignal-client keys for production.</p>
      <button onClick={publish} style={{ padding: 8 }}>Publish Dev Keys</button>
      {deviceId && <div style={{ marginTop: 8 }}>Device ID: <code>{deviceId}</code></div>}
      <div style={{ marginTop: 16 }}>
        <input value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} placeholder="Target userId" style={{ padding: 8, width: '60%' }} />
        <button onClick={fetchBundle} style={{ padding: 8, marginLeft: 8 }}>Fetch Bundle</button>
      </div>
      {bundle && (
        <pre style={{ marginTop: 16, background: '#f6f6f6', padding: 8, border: '1px solid #eee' }}>
{JSON.stringify(bundle, null, 2)}
        </pre>
      )}
      <div style={{ marginTop: 12 }}>{status}</div>
    </div>
  );
}

function apiBase() { return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'; }
