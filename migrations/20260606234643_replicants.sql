-- Replicants: background coding agents spawned from conversation (the
-- desktop app's replicas.js flow, now shared with the web). Plus per-project
-- integration settings for Deepgram + Replicas.

create table if not exists public.replicants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  message text not null,
  coding_agent text not null default 'claude',  -- 'claude' | 'codex'
  status text not null default 'proposed',      -- proposed|rejected|spawning|running|completed|failed
  replica_id text,
  url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.replicants enable row level security;

create policy "members use replicants" on public.replicants
  for all to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

grant select, insert, update on public.replicants to authenticated;

create index if not exists replicants_project_created_idx
  on public.replicants (project_id, created_at desc);

-- per-project integration settings (owner-only RLS already on this table)
alter table public.project_settings
  add column if not exists deepgram_api_key text,
  add column if not exists replicas_api_key text,
  add column if not exists replicas_environment_id text;
