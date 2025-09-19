"use client";

import { useState } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('');

  async function register() {
    setStatus('Requesting options…');
    const r = await fetch(api('/auth/register/options'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
      credentials: 'include',
    }).then((r) => r.json());
    if (!r.ok) return setStatus(r.error);
    const publicKey: PublicKeyCredentialCreationOptions = {
      ...r.data,
      challenge: b64uToBuf(r.data.challenge),
      user: { ...r.data.user, id: b64uToBuf(r.data.user.id) },
    };
    setStatus('Creating credential…');
    const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential;
    const attestationResponse = {
      id: cred.id,
      rawId: bufToB64u(cred.rawId),
      type: cred.type,
      response: {
        clientDataJSON: bufToB64u((cred.response as any).clientDataJSON),
        attestationObject: bufToB64u((cred.response as any).attestationObject),
      },
    };
    const v = await fetch(api('/auth/register/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, attestationResponse }),
      credentials: 'include',
    }).then((r) => r.json());
    setStatus(v.ok ? 'Registered!' : v.error);
  }

  async function login() {
    setStatus('Fetching request…');
    const r = await fetch(api('/auth/login/options'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
      credentials: 'include',
    }).then((r) => r.json());
    if (!r.ok) return setStatus(r.error);
    const publicKey: PublicKeyCredentialRequestOptions = {
      ...r.data,
      challenge: b64uToBuf(r.data.challenge),
      allowCredentials: r.data.allowCredentials?.map((c: any) => ({ ...c, id: b64uToBuf(c.id) })) ?? [],
    };
    setStatus('Requesting assertion…');
    const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential;
    const assertionResponse = {
      id: cred.id,
      rawId: bufToB64u(cred.rawId),
      type: cred.type,
      response: {
        clientDataJSON: bufToB64u((cred.response as any).clientDataJSON),
        authenticatorData: bufToB64u((cred.response as any).authenticatorData),
        signature: bufToB64u((cred.response as any).signature),
        userHandle: (cred.response as any).userHandle ? bufToB64u((cred.response as any).userHandle) : null,
      },
    };
    const v = await fetch(api('/auth/login/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, assertionResponse }),
      credentials: 'include',
    }).then((r) => r.json());
    setStatus(v.ok ? 'Logged in!' : v.error);
  }

  return (
    <div>
      <h1>Login with Passkey</h1>
      <input
        placeholder="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={{ padding: 8, marginRight: 8 }}
      />
      <button onClick={register} style={{ padding: 8, marginRight: 8 }}>Register</button>
      <button onClick={login} style={{ padding: 8 }}>Login</button>
      <div style={{ marginTop: 12 }}>{status}</div>
    </div>
  );
}

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return `${base}${path}`;
}

function b64uToBuf(s: string) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const str = atob(s + pad);
  const buf = new ArrayBuffer(str.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < str.length; i++) view[i] = str.charCodeAt(i);
  return buf;
}
function bufToB64u(buf: ArrayBuffer) {
  const bin = String.fromCharCode(...new Uint8Array(buf));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
