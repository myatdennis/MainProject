-- Ensure courses table has optional metadata columns referenced by the API
alter table if exists public.courses
  add column if not exists duration integer default 0,
  add column if not exists difficulty text default 'unknown',
  add column if not exists thumbnail text default '',
  add column if not exists instructor_name text default '',
  add column if not exists estimated_duration integer default 0,
  add column if not exists key_takeaways jsonb not null default '[]'::jsonb;

-- Modules description is used in the admin builder payloads
alter table if exists public.modules
  add column if not exists description text default '';

-- Organizations metadata required by admin org APIs
alter table if exists public.organizations
  add column if not exists slug text default concat('org-', substr(gen_random_uuid()::text, 1, 8)),
  add column if not exists type text default 'general',
  add column if not exists description text default '',
  add column if not exists logo text default '',
  add column if not exists contact_email text default 'ops@example.com',
  add column if not exists subscription text default 'trial',
  add column if not exists timezone text default 'UTC';

notify pgrst, 'reload schema';
