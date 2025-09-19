import type { FastifyInstance } from 'fastify';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { getCredentialById, getCredentialsForUser, updateCredentialCounter, ensureUser, getUserByUsername, upsertCredential } from './db.js';

const rpName = process.env.RP_NAME || 'La Ruche';
const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN || 'http://localhost:3000';

export function registerWebAuthnRoutes(app: FastifyInstance) {
  app.post('/auth/register/options', async (req: any, res: any) => {
    const { username } = (req.body as any) ?? {};
    if (!username) return { ok: false, error: 'username required' };
    const user = (await getUserByUsername(username)) ?? (await ensureUser(username));
    const creds = await getCredentialsForUser(user.id);
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: user.id,
      userName: user.username,
      attestationType: 'none',
      excludeCredentials: creds.map((c) => ({ id: c.credential_id, type: 'public-key' as const })),
      authenticatorSelection: { userVerification: 'preferred' },
    });
    // Persist challenge in cookie (signed)
    res.setCookie('lr_webauthn_chal', options.challenge, { httpOnly: true, path: '/', sameSite: 'strict', secure: true, signed: true });
    return { ok: true, data: options };
  });

  app.post('/auth/register/verify', async (req: any, res: any) => {
    const { username, attestationResponse } = (req.body as any) ?? {};
    if (!username) return { ok: false, error: 'username required' };
    const user = await getUserByUsername(username);
    if (!user) return { ok: false, error: 'unknown user' };
    const expectedChallenge = req.unsignCookie(req.cookies['lr_webauthn_chal'] || '').value;
    if (!expectedChallenge) return { ok: false, error: 'challenge missing' };
    const verification = await verifyRegistrationResponse({
      response: attestationResponse,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
    if (!verification.verified || !verification.registrationInfo) return { ok: false, error: 'attestation failed' };
    const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;
    await upsertCredential({ userId: user.id, credentialId: Buffer.from(credentialID), publicKey: Buffer.from(credentialPublicKey), counter });
    res.clearCookie('lr_webauthn_chal', { path: '/' });
    return { ok: true, data: { status: 'registered' } };
  });

  app.post('/auth/login/options', async (req: any, res: any) => {
    const { username } = (req.body as any) ?? {};
    const user = await getUserByUsername(username);
    if (!user) return { ok: false, error: 'unknown user' };
    const creds = await getCredentialsForUser(user.id);
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials: creds.map((c) => ({ id: c.credential_id, type: 'public-key' as const })),
    });
    res.setCookie('lr_webauthn_chal', options.challenge, { httpOnly: true, path: '/', sameSite: 'strict', secure: true, signed: true });
    return { ok: true, data: options };
  });

  app.post('/auth/login/verify', async (req: any, res: any) => {
    const { username, assertionResponse } = (req.body as any) ?? {};
    const user = await getUserByUsername(username);
    if (!user) return { ok: false, error: 'unknown user' };
    const expectedChallenge = req.unsignCookie(req.cookies['lr_webauthn_chal'] || '').value;
    if (!expectedChallenge) return { ok: false, error: 'challenge missing' };
    const credIdBuf = Buffer.from(assertionResponse.rawId.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const dbCred = await getCredentialById(credIdBuf);
    if (!dbCred) return { ok: false, error: 'unknown credential' };
    const verification = await verifyAuthenticationResponse({
      response: assertionResponse,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        counter: Number(dbCred.counter),
        credentialID: dbCred.credential_id,
        credentialPublicKey: dbCred.public_key,
      },
    });
    if (!verification.verified || !verification.authenticationInfo) return { ok: false, error: 'assertion failed' };
    const { newCounter } = verification.authenticationInfo;
    await updateCredentialCounter(dbCred.credential_id, newCounter);
    res.clearCookie('lr_webauthn_chal', { path: '/' });
    // Set signed session cookie
    res.setCookie('lr_session', user.id, { httpOnly: true, path: '/', sameSite: 'strict', secure: true, signed: true });
    return { ok: true, data: { status: 'authenticated' } };
  });
}
