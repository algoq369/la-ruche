// Loosen cross-package typing to avoid workspace type coupling during development
type PublishPrekeysRequest = any;
type PrekeyBundleResponse = any;

export async function publishPrekeys(apiBase: string, body: PublishPrekeysRequest, credentials: RequestCredentials = 'include') {
  const res = await fetch(`${apiBase}/keys/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials,
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: true; data: { deviceId: string } } | { ok: false; error: string }>;
}

export async function fetchBundle(apiBase: string, userId: string, credentials: RequestCredentials = 'include') {
  const res = await fetch(`${apiBase}/keys/${encodeURIComponent(userId)}/bundle`, { credentials });
  return res.json() as Promise<{ ok: true; data: PrekeyBundleResponse } | { ok: false; error: string }>;
}
