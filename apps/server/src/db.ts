import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return { rows: res.rows };
  } finally {
    client.release();
  }
}

// Minimal persistence helpers
export async function ensureUser(username: string): Promise<{ id: string; username: string }> {
  const { rows } = await query<{ id: string; username: string }>(
    'INSERT INTO app_user (username) VALUES ($1) ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username RETURNING id, username',
    [username]
  );
  return rows[0];
}

export async function getUserByUsername(username: string) {
  const { rows } = await query<{ id: string; username: string }>('SELECT id, username FROM app_user WHERE username=$1', [username]);
  return rows[0] || null;
}

export async function getUserById(id: string) {
  const { rows } = await query<{ id: string; username: string }>('SELECT id, username FROM app_user WHERE id=$1', [id]);
  return rows[0] || null;
}

export async function upsertCredential(data: {
  userId: string;
  credentialId: Buffer;
  publicKey: Buffer;
  counter: number;
}) {
  await query(
    `INSERT INTO webauthn_credential (user_id, credential_id, public_key, counter)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (credential_id) DO UPDATE SET counter = EXCLUDED.counter`,
    [data.userId, data.credentialId, data.publicKey, data.counter]
  );
}

export async function getCredentialsForUser(userId: string) {
  const { rows } = await query<{ credential_id: Buffer; public_key: Buffer; counter: number }>(
    'SELECT credential_id, public_key, counter FROM webauthn_credential WHERE user_id=$1',
    [userId]
  );
  return rows;
}

export async function getCredentialById(credentialId: Buffer) {
  const { rows } = await query<{ user_id: string; credential_id: Buffer; public_key: Buffer; counter: number }>(
    'SELECT user_id, credential_id, public_key, counter FROM webauthn_credential WHERE credential_id=$1',
    [credentialId]
  );
  return rows[0] || null;
}

export async function updateCredentialCounter(credentialId: Buffer, counter: number) {
  await query('UPDATE webauthn_credential SET counter=$2 WHERE credential_id=$1', [credentialId, counter]);
}

export async function listDevices(userId: string) {
  const { rows } = await query<{ id: string; name: string; verified: boolean; created_at: string; last_seen: string | null }>(
    'SELECT id, name, verified, created_at, last_seen FROM device WHERE user_id=$1 ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}
