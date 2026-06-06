-- Unified inbox for messages arriving from external messaging platforms
-- (Discord, Slack, and Maskord once it lands on Composio). Composio triggers
-- deliver platform events; each becomes one row here. These sit alongside the
-- voice-app's transcript_segments as another "people talking" source that can
-- drive the agents.

create table if not exists public.platform_messages (
  id uuid primary key default gen_random_uuid(),
  platform text not null,                 -- 'discord' | 'slack' | 'maskord' | ...
  channel_id text not null,               -- platform-native channel/room id
  external_id text not null,              -- platform-native message id (dedup key)
  author_id text,                         -- platform-native user id
  author_name text,                       -- display name at time of receipt
  content text not null,
  sent_at timestamptz,                    -- platform timestamp of the message
  raw jsonb,                              -- full trigger payload for replay/debug
  created_at timestamptz not null default now(),
  unique (platform, external_id)
);

create index if not exists platform_messages_platform_channel_created_idx
  on public.platform_messages (platform, channel_id, created_at);

-- Written server-side with the admin key (Composio webhook receiver / listener
-- script). Enable RLS so the anon key can't read or write by default; add
-- user-scoped policies if/when end-user auth lands.
alter table public.platform_messages enable row level security;
