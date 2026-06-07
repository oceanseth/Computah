-- Where Computah should point the self-verification browser when a replicant
-- finishes (the project's staging/preview URL). Optional, per project.
alter table public.project_settings
  add column if not exists verify_url text;

-- lim.run API key so spawned replicants can build/test mobile via lim CLI
alter table public.project_settings
  add column if not exists lim_api_key text;
