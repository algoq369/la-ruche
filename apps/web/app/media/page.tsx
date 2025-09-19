"use client";

import { useState } from 'react';
import { aesGcmEncrypt, aesGcmDecrypt } from '@la-ruche/crypto-core';

export default function MediaPage() {
  const [status, setStatus] = useState('');
  const [downloadInfo, setDownloadInfo] = useState<{ url: string; keyB64: string; ivB64: string } | null>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('Encrypting…');
    const plain = new Uint8Array(await file.arrayBuffer());
    const key = crypto.getRandomValues(new Uint8Array(32));
    const { iv, ciphertext } = await aesGcmEncrypt(key, plain);
    setStatus('Requesting upload URL…');
    const r = await fetch(api('/media/upload-url'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ contentType: 'application/octet-stream' }),
    }).then((r) => r.json());
    if (!r.ok) { setStatus(r.error || 'Failed to get upload URL'); return; }
    const { url, key: objectKey } = r.data;
    setStatus('Uploading encrypted file…');
    const put = await fetch(url, { method: 'PUT', body: ciphertext, headers: { 'Content-Type': 'application/octet-stream' } });
    if (!put.ok) { setStatus('Upload failed'); return; }
    setStatus('Uploaded. Save the decryption key + iv and share via E2EE message.');
    setDownloadInfo({ url: objectKey, keyB64: toB64(key), ivB64: toB64(iv) });
  }

  async function testDownloadAndDecrypt() {
    if (!downloadInfo) return;
    setStatus('Requesting download URL…');
    const r = await fetch(api(`/media/download-url?key=${encodeURIComponent(downloadInfo.url)}`), {
      credentials: 'include',
    }).then((r) => r.json());
    if (!r.ok) { setStatus(r.error || 'Failed to get download URL'); return; }
    const res = await fetch(r.data.url);
    const ct = new Uint8Array(await res.arrayBuffer());
    setStatus('Decrypting…');
    const pt = await aesGcmDecrypt(fromB64(downloadInfo.keyB64), fromB64(downloadInfo.ivB64), ct);
    const blob = new Blob([pt], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'decrypted.bin';
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Downloaded and decrypted.');
  }

  return (
    <div>
      <h1>Media (Encrypted Upload)</h1>
      <input type="file" onChange={upload} />
      {downloadInfo && (
        <div style={{ marginTop: 12 }}>
          <div>Object key: <code>{downloadInfo.url}</code></div>
          <div>Key (base64): <code>{downloadInfo.keyB64}</code></div>
          <div>IV (base64): <code>{downloadInfo.ivB64}</code></div>
          <button onClick={testDownloadAndDecrypt} style={{ padding: 8, marginTop: 8 }}>Download & Decrypt</button>
          <p style={{ color: '#b00' }}>Share key+iv only via E2EE chat. Server only stores ciphertext.</p>
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
function toB64(u8: Uint8Array) { return btoa(String.fromCharCode(...u8)); }
function fromB64(s: string) { return new Uint8Array(atob(s).split('').map((c) => c.charCodeAt(0))); }

