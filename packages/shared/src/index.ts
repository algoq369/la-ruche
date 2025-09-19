export type UserId = string;
export type DeviceId = string;

export interface UserProfile {
  id: UserId;
  displayName: string;
  avatarUrl?: string;
}

export interface Device {
  id: DeviceId;
  userId: UserId;
  name: string;
  createdAt: string;
  lastSeenAt?: string;
  verified: boolean;
}

export interface MessageEnvelope {
  id: string;
  senderDevice: DeviceId;
  recipient: UserId | string; // groupId or userId
  ts: number;
  ciphertext: string; // base64
  authTag?: string;   // base64 (AEAD)
  header?: Record<string, string>; // minimized routing
}

export interface CreateChatRequest {
  peerUserId: UserId;
}

export interface SendMessageRequest {
  conversationId: string;
  payloadBase64: string; // ciphertext payload
}

export interface WebAuthnUser {
  id: string; // base64url user handle
  username: string;
  currentChallenge?: string;
}

export interface ApiResult<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
}

export type ApiResponse<T> = ApiResult<T> | ApiError;

// Signal prekey bundle exchange types
export interface PublishPrekeysRequest {
  deviceId?: string; // if omitted, server creates a device
  deviceName?: string;
  identityPubB64: string;      // base64 of identity public key
  signedPrekeyPubB64: string;  // base64 of signed prekey public
  signedPrekeySigB64: string;  // base64 of signature over signed prekey
  prekeys: Array<{ id: number; keyB64: string }>; // one-time prekeys
}

export interface PrekeyBundleResponse {
  userId: UserId;
  deviceId: DeviceId;
  identityPubB64: string;
  signedPrekeyPubB64: string;
  signedPrekeySigB64: string;
  oneTimePrekey?: { id: number; keyB64: string };
}
