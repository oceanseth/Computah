-- Web voice app + per-project Discord bot settings.

-- The voice tables (created by the Electron voice-app's migration) were
-- admin-only. The web app now runs the same flow in the browser, so let
-- authenticated users use them. Add user attribution to sessions.
alter table public.sessions
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create policy "authenticated use sessions" on public.sessions
  for all to authenticated using (true) with check (true);
create policy "authenticated use segments" on public.transcript_segments
  for all to authenticated using (true) with check (true);
create policy "authenticated read memories" on public.memories
  for select to authenticated using (true);

grant select, insert, update on public.sessions to authenticated;
grant select, insert on public.transcript_segments to authenticated;
grant select on public.memories to authenticated;

-- Per-project integration settings (owner-only). The channel replicator reads
-- these admin-side to use a project's own Discord bot instead of the default.
create table if not exists public.project_settings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  discord_bot_token text,
  updated_at timestamptz not null default now()
);

alter table public.project_settings enable row level security;

create policy "owners read settings" on public.project_settings
  for select to authenticated
  using (exists (select 1 from public.projects p
                 where p.id = project_id and p.owner_id = auth.uid()));
create policy "owners insert settings" on public.project_settings
  for insert to authenticated
  with check (exists (select 1 from public.projects p
                      where p.id = project_id and p.owner_id = auth.uid()));
create policy "owners update settings" on public.project_settings
  for update to authenticated
  using (exists (select 1 from public.projects p
                 where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projects p
                      where p.id = project_id and p.owner_id = auth.uid()));

grant select, insert, update on public.project_settings to authenticated;
