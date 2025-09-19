Architecture Overview

Monorepo
- apps/web — Next.js client UI, WebAuthn, WebSocket client, crypto-core integration.
- apps/server — Fastify API: auth (passkeys), WebSocket relay, security headers.
- packages/crypto-core — Abstraction over Signal protocol (libsignal-client), media crypto.
- packages/shared — Shared types.

Flows
1) Auth (Passkeys)
   - Client requests registration options → navigator.credentials.create → server verifies → sets session cookie.
   - Login similarly with navigator.credentials.get.
2) Messaging
   - Client establishes session keys (Signal) with peer device(s).
   - Client mints one-time WS token via HTTP (session required), opens WS, authenticates with token.
   - Encrypt plaintext → send ciphertext envelope over WebSocket (server relays only).
   - Recipient decrypts locally and renders.
3) Media
   - Generate per-file key → encrypt client-side → upload to object storage via signed URL.
   - Recipient downloads ciphertext and decrypts with file key conveyed inside E2EE message.

Security
- Strict HTTP/WS headers; CSP; HSTS; cookie hygiene.
- Server never sees plaintext; stores delivery metadata only.

Next
- Replace crypto-core mock with libsignal-client (WASM) and wire device bundles.
- Add device linking (QR + SAS), safety number UI, and group messaging (Sender Keys).
