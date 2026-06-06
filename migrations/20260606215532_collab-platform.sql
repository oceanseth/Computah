-- Collaborative platform: projects, members, chat channels, and external
-- platform links (Discord/Slack/Maskord). Web/voice chat messages live in
-- platform_messages (platform 'web' | 'voice', channel_id = channels.id::text);
-- bridged messages keep their platform-native channel_id and are mapped to a
-- project channel through channel_links.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member', -- 'owner' | 'member'
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (project_id, name)
);

create table if not exists public.channel_links (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  platform text not null,               -- 'discord' | 'slack' | 'maskord'
  external_channel_id text not null,    -- platform-native channel id
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (platform, external_channel_id)
);

-- SECURITY DEFINER membership check: policies on several tables consult
-- project_members; running as definer (project_admin) avoids recursive RLS.
create or replace function public.is_project_member(p_project uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------- projects
alter table public.projects enable row level security;

create policy "members read projects" on public.projects
  for select to authenticated
  using (owner_id = auth.uid() or public.is_project_member(id));

create policy "users create projects" on public.projects
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "owners update projects" on public.projects
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owners delete projects" on public.projects
  for delete to authenticated
  using (owner_id = auth.uid());

-- ---------------------------------------------------------- project_members
alter table public.project_members enable row level security;

create policy "members read membership" on public.project_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_project_member(project_id));

-- project owners manage membership; users may add themselves as owner row
-- when creating a project
create policy "owners manage membership" on public.project_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.projects p
               where p.id = project_id and p.owner_id = auth.uid())
  );

create policy "owners remove membership" on public.project_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.projects p
               where p.id = project_id and p.owner_id = auth.uid())
  );

-- ----------------------------------------------------------------- channels
alter table public.channels enable row level security;

create policy "members read channels" on public.channels
  for select to authenticated
  using (public.is_project_member(project_id));

create policy "members create channels" on public.channels
  for insert to authenticated
  with check (public.is_project_member(project_id));

create policy "members delete channels" on public.channels
  for delete to authenticated
  using (public.is_project_member(project_id));

-- ------------------------------------------------------------ channel_links
alter table public.channel_links enable row level security;

create policy "members read links" on public.channel_links
  for select to authenticated
  using (exists (select 1 from public.channels c
                 where c.id = channel_id and public.is_project_member(c.project_id)));

create policy "members create links" on public.channel_links
  for insert to authenticated
  with check (exists (select 1 from public.channels c
                      where c.id = channel_id and public.is_project_member(c.project_id)));

create policy "members delete links" on public.channel_links
  for delete to authenticated
  using (exists (select 1 from public.channels c
                 where c.id = channel_id and public.is_project_member(c.project_id)));

-- ------------------------------------------------------- platform_messages
-- Members can read messages for their channels: web/voice rows match
-- channel_id = channels.id::text; bridged rows match through channel_links.
create policy "members read channel messages" on public.platform_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.channels c
      where (
        (platform_messages.platform in ('web','voice')
         and platform_messages.channel_id = c.id::text)
        or exists (
          select 1 from public.channel_links l
          where l.channel_id = c.id
            and l.platform = platform_messages.platform
            and l.external_channel_id = platform_messages.channel_id
        )
      )
      and public.is_project_member(c.project_id)
    )
  );

-- Members post web/voice messages into their channels as themselves.
create policy "members write channel messages" on public.platform_messages
  for insert to authenticated
  with check (
    platform in ('web','voice')
    and author_id = auth.uid()::text
    and exists (
      select 1 from public.channels c
      where c.id::text = platform_messages.channel_id
        and public.is_project_member(c.project_id)
    )
  );

-- ------------------------------------------------------------------ grants
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, delete on public.project_members to authenticated;
grant select, insert, delete on public.channels to authenticated;
grant select, insert, delete on public.channel_links to authenticated;
grant select, insert on public.platform_messages to authenticated;

create index if not exists channels_project_idx on public.channels (project_id);
create index if not exists project_members_user_idx on public.project_members (user_id);
create index if not exists channel_links_channel_idx on public.channel_links (channel_id);
