-- Computah — InsForge schema
-- Run this in your InsForge project's SQL editor (or have your InsForge MCP/agent
-- create it). Also create a PUBLIC storage bucket named `computah-shots`.

create table if not exists verifications (
  id             uuid primary key default gen_random_uuid(),
  url            text        not null,
  goal           text        not null,
  status         text        not null default 'running',  -- running | passed | failed | error
  passed         boolean,
  reason         text,
  summary        text,
  steps          jsonb       not null default '[]'::jsonb,
  console_errors jsonb       not null default '[]'::jsonb,
  duration_ms    integer,
  created_at     timestamptz not null default now()
);

create index if not exists verifications_created_at_idx on verifications (created_at desc);
