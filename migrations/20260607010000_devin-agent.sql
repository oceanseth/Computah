-- Devin (devin.ai) as a third coding agent alongside Replicas. Spoken
-- "send Devin to build X" → a proposed replicant with coding_agent='devin' →
-- approve → a Devin session. Per-project API key, owner-only (same RLS as the
-- other integration settings on this table).
alter table public.project_settings
  add column if not exists devin_api_key text;
