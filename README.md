La Ruche — Encrypted Messaging (Monorepo)

Overview
- Web + API scaffold for an end-to-end encrypted messenger.
- Strong defaults: passkeys (WebAuthn), device linking, E2EE interfaces, strict security headers.

Structure
- apps/web — Next.js app (login, chat UI skeleton, device linking)
- apps/server — Fastify API (auth, WebSocket relay, security headers, stubs)
- packages/crypto-core — Crypto interfaces for Signal-like protocol + mock implementation
- packages/shared — Shared types and validators

Getting Started
1) Requirements
   - Node 18.17+
   - pnpm or npm
2) Install
   - pnpm install   (or npm install)  [requires network]
3) Env
   - Copy apps/server/.env.example to apps/server/.env and adjust values
   - Set DB_URL to your Postgres; run migrations in apps/server/migrations
4) Dev
   - In one terminal: pnpm --filter @la-ruche/server dev
   - In another:      pnpm --filter @la-ruche/web dev

Security Highlights
- WebAuthn (passkeys) for auth; no passwords.
- Minimal metadata on server; messages are ciphertext-only.
- Client-side encrypted media (per-file keys) planned via crypto-core.
- Strict CSP, HSTS, secure cookies, and rate limiting.
- WS auth uses short-lived one-time tokens minted from an authenticated session (HTTP), avoiding long-lived client tokens.

Next Steps
- Integrate libsignal-client (WASM) in packages/crypto-core and wire into web + server.
- Implement device linking (QR + SAS) flows.
- Add sealed-sender and contact verification UX.
 - Use new key APIs for Signal sessions:
   - POST /keys/publish — publish identity + signed prekey + one-time prekeys
   - GET /keys/:userId/bundle — fetch a peer bundle (consumes a one-time prekey)
