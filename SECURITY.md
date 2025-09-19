Security Design (High Level)

Goals
- End-to-end encryption by default (server stores only ciphertext).
- Minimize metadata: required routing info only, strict retention.
- Strong authentication with passkeys (WebAuthn) and device verification.

Core Protocol Choices
- 1:1: Signal (X3DH + Double Ratchet) via libsignal-client (WASM on web).
- Groups: Signal Sender Keys initially; plan for MLS migration.
- Media: client-side encrypted with per-file keys (AEAD; AES-GCM/ChaCha20-Poly1305).

Key Management
- Identity key pair generated on device; never leaves secure storage.
- Device linking via QR + SAS verification; display safety numbers.
- Optional zero-knowledge encrypted backup (Argon2id-derived KEK + AES-GCM).

Client Hardening
- Strict CSP, HSTS, COOP/COEP/CORP, secure cookies.
- Avoid storing plaintext in memory longer than necessary; zeroize buffers.
- Mobile: enable biometrics lock, screenshot protections, jailbreak/root checks.

Server Practices
- No plaintext content; validate all inputs; rate limit sensitive endpoints.
- Short-lived tokens; secret rotation; log redaction; structured audit logs.
- Encrypt at rest; least-privilege DB roles; periodic data purges.

Threats Considered
- MITM during enrollment (mitigated by passkeys + SAS verification).
- Server compromise (limited by E2EE + minimal metadata).
- Device compromise (mitigated by device list, revoke, biometric lock, backups).

Operational
- Automated dependency updates; SAST; CI enforcement.
- Coordinated vulnerability disclosure policy and periodic third-party audits.

