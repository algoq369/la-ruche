-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- Users and WebAuthn credentials
create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists webauthn_credential (
  credential_id bytea primary key,
  user_id uuid not null references app_user(id) on delete cascade,
  public_key bytea not null,
  counter bigint not null default 0,
  created_at timestamptz not null default now()
);

-- Devices
create table if not exists device (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  name text not null default 'Linked Device',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen timestamptz,
  identity_pub bytea,
  spk_pub bytea,
  spk_sig bytea
);

-- Device link audit (optional)
create table if not exists device_link_event (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  token text,
  sas text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- One-time prekeys per device
create table if not exists prekey (
  device_id uuid not null references device(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  key_id integer not null,
  pubkey bytea not null,
  used boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (device_id, key_id)
);
create index if not exists prekey_user_idx on prekey(user_id, used);

-- Optional: sessions table if you want DB-backed sessions
-- create table if not exists user_session (
--   id uuid primary key default gen_random_uuid(),
--   user_id uuid not null references app_user(id) on delete cascade,
--   token text not null unique,
--   created_at timestamptz not null default now(),
--   expires_at timestamptz
-- );
