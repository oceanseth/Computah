-- Replicants table now stores all proposal cards (not just coding-agent
-- requests). `kind` discriminates the card; `payload` carries kind-specific
-- structured fields the LLM extracted from the transcript (recipient, subject,
-- linear team, notion title, etc.).
--   kind = 'agent'  → coding-agent task (existing flow, uses `coding_agent`)
--   kind = 'email'  → Gmail draft  (payload: { to, subject, body })
--   kind = 'linear' → Linear issue (payload: { team, title, body })
--   kind = 'slack'  → Slack send   (payload: { channel, body })
--   kind = 'notion' → Notion page  (payload: { title, body })
--   kind = 'attio'  → Attio record (payload: { recordType, name, notes })

alter table public.replicants
  add column if not exists kind text not null default 'agent',
  add column if not exists payload jsonb;

create index if not exists replicants_project_kind_idx
  on public.replicants (project_id, kind);
