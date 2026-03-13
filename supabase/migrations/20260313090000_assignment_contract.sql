-- Align assignments table with current data contract for bulk org/user assignments
alter table if exists public.assignments
  add column if not exists organization_id uuid,
  add column if not exists user_id text,
  add column if not exists note text,
  add column if not exists due_at timestamp with time zone,
  add column if not exists assigned_by text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists active boolean default true,
  add column if not exists status text default 'assigned',
  add column if not exists progress integer default 0,
  add column if not exists created_at timestamp with time zone default now(),
  add column if not exists updated_at timestamp with time zone default now();

create index if not exists assignments_course_id_idx on public.assignments(course_id);
create index if not exists assignments_user_id_idx on public.assignments(lower(user_id));
create index if not exists assignments_org_id_idx on public.assignments(organization_id);

comment on column public.assignments.metadata is
  'Stores structured assignment metadata (surface, mode, analytics context).';
