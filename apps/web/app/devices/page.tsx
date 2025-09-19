"use client";

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function DevicesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [sas, setSas] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  async function startLink() {
    setStatus('Requesting link…');
    const r = await fetch(api('/device/link/init'), {
      method: 'POST',
      credentials: 'include',
    }).then((r) => r.json());
    if (!r.ok) {
      setStatus(r.error);
      return;
    }
    setToken(r.data.token);
    setSas(r.data.sas);
    const qr = await QRCode.toDataURL(r.data.qr, { margin: 1, width: 240 });
    setQrDataUrl(qr);
    setStatus('Scan this QR with your new device');
  }

  return (
    <div>
      <h1>Devices</h1>
      <button onClick={startLink} style={{ padding: 8 }}>Link a new device</button>
      {token && (
        <div style={{ marginTop: 16 }}>
          <div>Verification code (SAS): <strong>{sas}</strong></div>
          {qrDataUrl ? (
            <img alt="QR" src={qrDataUrl} />
          ) : null}
          <div style={{ marginTop: 8, color: '#666' }}>Token: {token}</div>
        </div>
      )}
      <div style={{ marginTop: 12 }}>{status}</div>
    </div>
  );
}

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return `${base}${path}`;
}

