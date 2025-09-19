"use client";

import { useState } from 'react';

export default function LinkDevicePage() {
  const [token, setToken] = useState('');
  const [result, setResult] = useState('');

  async function complete() {
    setResult('Linking…');
    const r = await fetch(api('/device/link/complete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then((r) => r.json());
    if (!r.ok) setResult(r.error);
    else setResult(`Linked to user ${r.data.userId}. Verify code: ${r.data.sas}`);
  }

  return (
    <div>
      <h1>Link This Device</h1>
      <p>Paste the code or scan QR (out-of-band), then submit.</p>
      <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token" style={{ padding: 8, width: '70%' }} />
      <button onClick={complete} style={{ padding: 8, marginLeft: 8 }}>Complete</button>
      <div style={{ marginTop: 12 }}>{result}</div>
    </div>
  );
}

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return `${base}${path}`;
}

