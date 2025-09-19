// Crypto-core interfaces for Signal-like E2EE. Real implementation should wrap libsignal-client.

export interface IdentityKeys {
  identityKeyPair: Uint8Array; // private portion held locally only
  identityKeyPub: Uint8Array;  // publishable part
}

export interface SessionState {
  peerDeviceId: string;
  sessionId: string;
}

export interface CryptoEngine {
  generateIdentity(): Promise<IdentityKeys>;
  createSession(peerBundle: Uint8Array): Promise<SessionState>;
  encrypt(session: SessionState, plaintext: Uint8Array): Promise<Uint8Array>;
  decrypt(session: SessionState, ciphertext: Uint8Array): Promise<Uint8Array>;
  generateFileKey(): Promise<Uint8Array>;
  encryptStream(fileKey: Uint8Array, chunk: Uint8Array): Promise<Uint8Array>;
  decryptStream(fileKey: Uint8Array, chunk: Uint8Array): Promise<Uint8Array>;
  encryptBytes?(key: Uint8Array, bytes: Uint8Array): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }>;
  decryptBytes?(key: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array>;
}

export class InsecureMockEngine implements CryptoEngine {
  async generateIdentity(): Promise<IdentityKeys> {
    const key = crypto.getRandomValues(new Uint8Array(32));
    return { identityKeyPair: key, identityKeyPub: key.slice(0, 32) };
  }

  async createSession(peerBundle: Uint8Array): Promise<SessionState> {
    const id = Buffer.from(peerBundle.slice(0, 8)).toString('hex');
    return { peerDeviceId: id, sessionId: id };
  }

  async encrypt(session: SessionState, plaintext: Uint8Array): Promise<Uint8Array> {
    const key = this.kdf(session.sessionId);
    const out = new Uint8Array(plaintext.length);
    for (let i = 0; i < plaintext.length; i++) out[i] = plaintext[i] ^ key[i % key.length];
    return out;
  }

  async decrypt(session: SessionState, ciphertext: Uint8Array): Promise<Uint8Array> {
    return this.encrypt(session, ciphertext);
  }

  async generateFileKey(): Promise<Uint8Array> {
    return crypto.getRandomValues(new Uint8Array(32));
  }

  async encryptStream(fileKey: Uint8Array, chunk: Uint8Array): Promise<Uint8Array> {
    const out = new Uint8Array(chunk.length);
    for (let i = 0; i < chunk.length; i++) out[i] = chunk[i] ^ fileKey[i % fileKey.length];
    return out;
  }

  async decryptStream(fileKey: Uint8Array, chunk: Uint8Array): Promise<Uint8Array> {
    return this.encryptStream(fileKey, chunk);
  }

  private kdf(s: string): Uint8Array {
    const bytes = new TextEncoder().encode(s);
    const out = new Uint8Array(32);
    for (let i = 0; i < out.length; i++) out[i] = bytes[i % bytes.length] ^ (i * 31);
    return out;
  }
}

export { createEngine } from './libsignal.js';

// AES-GCM helpers using WebCrypto
export async function aesGcmEncrypt(key: Uint8Array, data: Uint8Array) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto not available');

  // ✅ Use key.buffer as ArrayBuffer & cast explicitly
  const k = await subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  // Build a DataView backed by a concrete ArrayBuffer to satisfy TS BufferSource
  const ct = new Uint8Array(
    await (subtle as any).encrypt({ name: 'AES-GCM', iv }, k, data)
  );

  return { iv, ciphertext: ct };
}

export async function aesGcmDecrypt(key: Uint8Array, iv: Uint8Array, ct: Uint8Array) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto not available');

  const k = await subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const pt = new Uint8Array(
    await (subtle as any).decrypt({ name: 'AES-GCM', iv }, k, ct)
  );
  return pt;
}
