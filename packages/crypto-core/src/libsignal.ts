// Placeholder wrapper for libsignal-client (WASM) with dynamic import.
// Replace with actual bindings and initialization once dependency is added.

import type { CryptoEngine, IdentityKeys, SessionState } from './index.js';

export class SignalEngine implements CryptoEngine {
  private ready: Promise<any>;
  constructor() {
    this.ready = this.init();
  }
  private async init() {
    // const lib = await import('@signalapp/libsignal-client');
    return {};
  }
  async generateIdentity(): Promise<IdentityKeys> {
    await this.ready;
    throw new Error('SignalEngine not implemented: add libsignal-client');
  }
  async createSession(_peerBundle: Uint8Array): Promise<SessionState> {
    await this.ready;
    throw new Error('SignalEngine not implemented: add libsignal-client');
  }
  async encrypt(_session: SessionState, _plaintext: Uint8Array): Promise<Uint8Array> {
    await this.ready;
    throw new Error('SignalEngine not implemented: add libsignal-client');
  }
  async decrypt(_session: SessionState, _ciphertext: Uint8Array): Promise<Uint8Array> {
    await this.ready;
    throw new Error('SignalEngine not implemented: add libsignal-client');
  }
  async generateFileKey(): Promise<Uint8Array> {
    // Media keys can be derived from a CSPRNG
    return crypto.getRandomValues(new Uint8Array(32));
  }
  async encryptStream(fileKey: Uint8Array, chunk: Uint8Array): Promise<Uint8Array> {
    // Replace with streaming AEAD (e.g., XChaCha20-Poly1305 with chunked nonce)
    const out = new Uint8Array(chunk.length);
    for (let i = 0; i < chunk.length; i++) out[i] = chunk[i] ^ fileKey[i % fileKey.length];
    return out;
  }
  async decryptStream(fileKey: Uint8Array, chunk: Uint8Array): Promise<Uint8Array> {
    return this.encryptStream(fileKey, chunk);
  }
}

export function createEngine(_preferSignal = true): CryptoEngine {
  // Feature flag to use mock in dev: NEXT_PUBLIC_USE_MOCK_CRYPTO='true'
  const useMock = typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_USE_MOCK_CRYPTO === 'true';
  if (!useMock) {
    try {
      return new SignalEngine();
    } catch {
      // fall back
    }
  }
  const { InsecureMockEngine } = require('./index');
  return new InsecureMockEngine();
}
