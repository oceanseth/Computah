-- Realtime hub channels: every platform_messages insert is pushed to
-- 'hub:<project-channel-uuid>' so the web chat and the channel replicator
-- react instantly instead of polling.

insert into realtime.channels (pattern, description, enabled)
values ('hub:%', 'Per project-channel message hub', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

create or replace function public.notify_platform_message()
returns trigger as $$
declare
  hub uuid;
  payload jsonb;
begin
  payload := jsonb_build_object(
    'id', NEW.id,
    'platform', NEW.platform,
    'channel_id', NEW.channel_id,
    'author_id', NEW.author_id,
    'author_name', NEW.author_name,
    'content', NEW.content,
    'sent_at', NEW.sent_at,
    'created_at', NEW.created_at
  );
  if NEW.platform in ('web', 'voice') then
    perform realtime.publish('hub:' || NEW.channel_id, 'new_message', payload);
  else
    -- bridged rows map to hubs through channel_links
    for hub in
      select channel_id from public.channel_links
      where platform = NEW.platform and external_channel_id = NEW.channel_id
    loop
      perform realtime.publish('hub:' || hub::text, 'new_message', payload);
    end loop;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger platform_messages_notify
after insert on public.platform_messages
for each row execute function public.notify_platform_message();

-- only project members may subscribe to a hub
alter table realtime.channels enable row level security;

create policy "members subscribe hubs" on realtime.channels
  for select to authenticated
  using (
    pattern = 'hub:%'
    and public.is_project_member((
      select c.project_id from public.channels c
      where c.id = nullif(split_part(realtime.channel_name(), ':', 2), '')::uuid
    ))
  );
